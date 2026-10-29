import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { calendarWindow, currentUser, database, digest, endSession, equalHash, passwordHash, randomToken, startSession, validDay } from '@/lib/server';
import { daysBetween } from '@/lib/recommend';
import { canEditTrip, canReadRoom } from '@/lib/permissions';

class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
function need(condition: unknown, message: string, status = 400): asserts condition { if (!condition) throw new InputError(message, status); }
function text(value: unknown, max: number): string { need(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, 'Alan eksik veya çok uzun.'); return value.trim(); }
function money(value: unknown): number { need(Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 10_000_000, 'Geçerli bir TL tutarı gir.'); return Number(value); }
function reply(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(request: NextRequest) {
  try {
    need(request.headers.get('origin') === request.nextUrl.origin, 'Geçersiz istek.', 403);
    const raw = await request.text();
    need(raw.length <= 20_000, 'İstek çok büyük.');
    const input = JSON.parse(raw) as Record<string, unknown>;
    const db = database();

    if (input.action === 'register' || input.action === 'login') {
      const address = request.headers.get('cf-connecting-ip') ?? 'address-unavailable';
      const key = await digest(`auth:${input.action}:${address}`);
      const now = Date.now();
      const limit = await db.prepare('SELECT attempts, reset_at AS resetAt FROM auth_limits WHERE key = ?').bind(key).first<{ attempts: number; resetAt: number }>();
      const maximum = address === 'address-unavailable' ? 100 : input.action === 'register' ? 30 : 60;
      need(!limit || limit.resetAt < now || limit.attempts < maximum, 'Çok fazla deneme. 15 dakika sonra tekrar dene.', 429);
      await db.prepare('INSERT INTO auth_limits (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at < ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END').bind(key, now + 15 * 60_000, now, now).run();
    }

    if (input.action === 'register') {
      const username = text(input.username, 30).toLocaleLowerCase('tr-TR');
      need(/^[\p{L}\p{N}_.-]{3,30}$/u.test(username), 'Ad 3–30 karakter olmalı; boşluk içermemeli.');
      need(typeof input.password === 'string' && input.password.length >= 10 && input.password.length <= 128, 'Şifre 10–128 karakter olmalı.');
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      need(!existing, 'Bu ad kullanılıyor.', 409);
      const salt = randomToken().slice(0, 32);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, username, await passwordHash(input.password, salt), salt, Date.now()).run();
      await startSession(id);
      return reply({ ok: true });
    }

    if (input.action === 'login') {
      const username = text(input.username, 30).toLocaleLowerCase('tr-TR');
      const user = await db.prepare('SELECT id, password_hash AS passwordHash, salt FROM users WHERE username = ?').bind(username).first<{ id: string; passwordHash: string; salt: string }>();
      need(typeof input.password === 'string', 'Ad veya şifre hatalı.', 401);
      // Equal-cost verification also runs for unknown names.
      const salt = user?.salt ?? '00000000000000000000000000000000';
      const expected = user?.passwordHash ?? '0'.repeat(64);
      const actual = await passwordHash(input.password, salt);
      need(user && equalHash(expected, actual), 'Ad veya şifre hatalı.', 401);
      await startSession(user.id);
      return reply({ ok: true });
    }

    const user = await currentUser();
    need(user, 'Giriş yapmalısın.', 401);
    if (input.action === 'logout') { await endSession(); return reply({ ok: true }); }

    if (input.action === 'createRoom') {
      const name = text(input.name, 60);
      const roomId = crypto.randomUUID();
      const inviteToken = randomToken().slice(0, 24);
      await db.batch([
        db.prepare('INSERT INTO rooms (id, name, owner_id, invite_token, created_at) VALUES (?, ?, ?, ?, ?)').bind(roomId, name, user.id, inviteToken, Date.now()),
        db.prepare("INSERT INTO memberships (room_id, user_id, status) VALUES (?, ?, 'approved')").bind(roomId, user.id),
      ]);
      return reply({ ok: true, roomId });
    }
    if (input.action === 'joinRoom') {
      const inviteToken = text(input.inviteToken, 60);
      const room = await db.prepare('SELECT id FROM rooms WHERE invite_token = ?').bind(inviteToken).first<{ id: string }>();
      need(room, 'Davet bağlantısı geçersiz.', 404);
      await db.prepare("INSERT INTO memberships (room_id, user_id, status) VALUES (?, ?, 'pending') ON CONFLICT(room_id, user_id) DO NOTHING").bind(room.id, user.id).run();
      return reply({ ok: true, roomId: room.id });
    }

    const roomId = text(input.roomId, 100);
    const room = await db.prepare('SELECT rooms.owner_id AS ownerId, memberships.status FROM rooms LEFT JOIN memberships ON memberships.room_id = rooms.id AND memberships.user_id = ? WHERE rooms.id = ?').bind(user.id, roomId).first<{ ownerId: string; status: string | null }>();
    need(room, 'Oda bulunamadı.', 404);

    if (input.action === 'approveMember' || input.action === 'removeMember') {
      need(room.ownerId === user.id, 'Yalnız oda yöneticisi bu işlemi yapabilir.', 403);
      const targetId = text(input.userId, 100);
      need(targetId !== room.ownerId, 'Oda sahibi kaldırılamaz.');
      const member = await db.prepare('SELECT status FROM memberships WHERE room_id = ? AND user_id = ?').bind(roomId, targetId).first<{ status: string }>();
      need(member, 'Üye bulunamadı.', 404);
      if (input.action === 'approveMember') {
        need(member.status === 'pending', 'Onay bekleyen üye yok.');
        await db.prepare("UPDATE memberships SET status = 'approved' WHERE room_id = ? AND user_id = ?").bind(roomId, targetId).run();
      } else {
        await db.prepare('DELETE FROM memberships WHERE room_id = ? AND user_id = ?').bind(roomId, targetId).run();
      }
      return reply({ ok: true });
    }

    need(canReadRoom(room.status), 'Bu odaya erişimin yok.', 403);

    if (input.action === 'setBudget') {
      const budget = money(input.budget);
      await db.prepare('UPDATE memberships SET budget = ? WHERE room_id = ? AND user_id = ?').bind(budget, roomId, user.id).run();
      return reply({ ok: true });
    }

    if (input.action === 'setAvailability') {
      const { start, end } = calendarWindow();
      need(validDay(input.from) && validDay(input.to) && input.from >= start && input.to <= end && input.from <= input.to, 'Tarih altı aylık takvim içinde olmalı.');
      const days = daysBetween(input.from, input.to);
      need(days.length > 0 && days.length <= 190 && days.at(-1) === input.to, 'Tarih aralığı geçersiz.');
      need(input.status === 'green' || input.status === 'yellow' || input.status === 'red' || input.status === null, 'Durum geçersiz.');
      await db.batch(days.map(day => input.status === null
        ? db.prepare('DELETE FROM availability WHERE room_id = ? AND user_id = ? AND day = ?').bind(roomId, user.id, day)
        : db.prepare('INSERT INTO availability (room_id, user_id, day, status) VALUES (?, ?, ?, ?) ON CONFLICT(room_id, user_id, day) DO UPDATE SET status = excluded.status').bind(roomId, user.id, day, input.status)));
      return reply({ ok: true });
    }

    if (input.action === 'createTrip' || input.action === 'updateTrip') {
      const title = text(input.title, 80);
      const description = typeof input.description === 'string' ? input.description.trim() : '';
      need(description.length <= 500, 'Açıklama çok uzun.');
      const { start, end } = calendarWindow();
      need(validDay(input.startDay) && validDay(input.endDay) && input.startDay >= start && input.endDay <= end && input.startDay <= input.endDay, 'Gezi tarihleri altı aylık takvim içinde olmalı.');
      const flightCost = money(input.flightCost);
      const spendCost = money(input.spendCost);
      if (input.action === 'createTrip') {
        const tripId = crypto.randomUUID();
        await db.prepare('INSERT INTO trips (id, room_id, creator_id, title, description, start_day, end_day, flight_cost, spend_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(tripId, roomId, user.id, title, description, input.startDay, input.endDay, flightCost, spendCost, Date.now()).run();
        return reply({ ok: true, tripId });
      }
      const tripId = text(input.tripId, 100);
      const trip = await db.prepare('SELECT creator_id AS creatorId FROM trips WHERE id = ? AND room_id = ?').bind(tripId, roomId).first<{ creatorId: string }>();
      need(trip && canEditTrip(user.id, trip.creatorId, room.ownerId, room.status), 'Gezi düzenleme iznin yok.', 403);
      await db.prepare('UPDATE trips SET title = ?, description = ?, start_day = ?, end_day = ?, flight_cost = ?, spend_cost = ? WHERE id = ? AND room_id = ?').bind(title, description, input.startDay, input.endDay, flightCost, spendCost, tripId, roomId).run();
      return reply({ ok: true });
    }

    if (input.action === 'deleteTrip' || input.action === 'rateTrip') {
      const tripId = text(input.tripId, 100);
      const trip = await db.prepare('SELECT creator_id AS creatorId FROM trips WHERE id = ? AND room_id = ?').bind(tripId, roomId).first<{ creatorId: string }>();
      need(trip, 'Gezi bulunamadı.', 404);
      if (input.action === 'deleteTrip') {
        need(canEditTrip(user.id, trip.creatorId, room.ownerId, room.status), 'Gezi silme iznin yok.', 403);
        await db.prepare('DELETE FROM trips WHERE id = ? AND room_id = ?').bind(tripId, roomId).run();
      } else if (input.score === null) {
        await db.prepare('DELETE FROM ratings WHERE trip_id = ? AND user_id = ?').bind(tripId, user.id).run();
      } else {
        need(Number.isInteger(input.score) && Number(input.score) >= 0 && Number(input.score) <= 5, 'İlgi puanı 0–5 olmalı.');
        await db.prepare('INSERT INTO ratings (trip_id, user_id, score) VALUES (?, ?, ?) ON CONFLICT(trip_id, user_id) DO UPDATE SET score = excluded.score').bind(tripId, user.id, input.score).run();
      }
      return reply({ ok: true });
    }
    throw new InputError('Bilinmeyen işlem.');
  } catch (error) {
    if (error instanceof InputError) return reply({ error: error.message }, error.status);
    console.error(error);
    return reply({ error: 'İşlem tamamlanamadı. Tekrar dene.' }, 500);
  }
}
