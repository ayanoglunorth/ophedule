import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

export type User = { id: string; username: string };

export function database(): D1Database {
  if (!env.DB) throw new Error('D1 bağlantısı yok');
  return env.DB;
}

export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt.match(/../g)!.map(byte => parseInt(byte, 16))), iterations: 600_000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function equalHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get('ophedule_session')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await database().prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?')
    .bind(await digest(token), Date.now()).first<User>();
  return row ?? null;
}

export async function startSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  await database().prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await digest(token), userId, expiresAt).run();
  (await cookies()).set('ophedule_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(expiresAt) });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get('ophedule_session')?.value;
  if (token) await database().prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run();
  jar.delete('ophedule_session');
}

export function todayInIstanbul(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function calendarWindow(): { start: string; end: string } {
  const start = todayInIstanbul();
  const [year, month, day] = start.split('-').map(Number);
  const boundary = new Date(Date.UTC(year, month - 1 + 6, day));
  boundary.setUTCDate(boundary.getUTCDate() - 1);
  return { start, end: boundary.toISOString().slice(0, 10) };
}

export function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
