import { NextRequest, NextResponse } from 'next/server';
import { calendarWindow, currentUser, database } from '@/lib/server';
import { canReadRoom } from '@/lib/permissions';
import { rankTrips, type Availability, type Member, type Rating, type Trip } from '@/lib/recommend';

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const db = database();
  const roomId = request.nextUrl.searchParams.get('room');
  if (!roomId) {
    const rooms = await db.prepare('SELECT rooms.id, rooms.name, rooms.owner_id AS ownerId, rooms.invite_token AS inviteToken, memberships.status FROM memberships JOIN rooms ON rooms.id = memberships.room_id WHERE memberships.user_id = ? ORDER BY rooms.created_at DESC').bind(user.id).all();
    return NextResponse.json({ user, rooms: rooms.results });
  }
  const room = await db.prepare('SELECT rooms.id, rooms.name, rooms.owner_id AS ownerId, rooms.invite_token AS inviteToken, memberships.status FROM rooms JOIN memberships ON memberships.room_id = rooms.id WHERE rooms.id = ? AND memberships.user_id = ?').bind(roomId, user.id).first<{ id: string; name: string; ownerId: string; inviteToken: string; status: string }>();
  if (!room || !canReadRoom(room.status)) return NextResponse.json({ error: 'Bu odaya erişimin yok.' }, { status: 403 });
  const window = calendarWindow();
  const statements = [
    db.prepare("SELECT users.id, users.username AS name, memberships.budget FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.room_id = ? AND memberships.status = 'approved' ORDER BY users.username").bind(roomId),
    db.prepare("SELECT availability.user_id AS userId, availability.day, availability.status FROM availability JOIN memberships ON memberships.room_id = availability.room_id AND memberships.user_id = availability.user_id AND memberships.status = 'approved' WHERE availability.room_id = ? AND availability.day BETWEEN ? AND ?").bind(roomId, window.start, window.end),
    db.prepare('SELECT id, creator_id AS creatorId, title, description, start_day AS startDay, end_day AS endDay, flight_cost AS flightCost, spend_cost AS spendCost, created_at AS createdAt FROM trips WHERE room_id = ? AND end_day >= ? ORDER BY created_at DESC').bind(roomId, window.start),
    db.prepare("SELECT ratings.trip_id AS tripId, ratings.user_id AS userId, ratings.score FROM ratings JOIN trips ON trips.id = ratings.trip_id JOIN memberships ON memberships.room_id = trips.room_id AND memberships.user_id = ratings.user_id AND memberships.status = 'approved' WHERE trips.room_id = ?").bind(roomId),
  ];
  if (room.ownerId === user.id) statements.push(db.prepare("SELECT users.id, users.username AS name FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.room_id = ? AND memberships.status = 'pending'").bind(roomId));
  const [membersRows, availabilityRows, tripRows, ratingRows, pendingRows] = await db.batch(statements);
  const members = membersRows.results as Member[];
  const availability = availabilityRows.results as Availability[];
  const ratings = ratingRows.results as Rating[];
  const trips = rankTrips(tripRows.results as (Trip & { creatorId: string; description: string })[], members, availability, ratings);
  return NextResponse.json({ user, room, window, members, availability, trips, ratings, pending: pendingRows?.results ?? [] });
}
