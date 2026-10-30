import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const token = (env as unknown as { OPHEDULE_RESET_TOKEN?: string }).OPHEDULE_RESET_TOKEN;
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = env.DB;
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  const tables = ['ratings', 'availability', 'memberships', 'trips', 'rooms', 'sessions', 'users', 'auth_limits'];
  await db.batch(tables.map(table => db.prepare(`DELETE FROM ${table}`)));
  const remaining = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
  return NextResponse.json({ usersRemaining: remaining?.count ?? null });
}
