import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('users_username_unique').on(table.username)]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
});

export const authLimits = sqliteTable('auth_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  resetAt: integer('reset_at').notNull(),
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  inviteToken: text('invite_token').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('rooms_invite_unique').on(table.inviteToken)]);

export const memberships = sqliteTable('memberships', {
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  budget: integer('budget'),
}, table => [primaryKey({ columns: [table.roomId, table.userId] })]);

export const availability = sqliteTable('availability', {
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  status: text('status').notNull(),
}, table => [primaryKey({ columns: [table.roomId, table.userId, table.day] })]);

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  creatorId: text('creator_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  startDay: text('start_day').notNull(),
  endDay: text('end_day').notNull(),
  flightCost: integer('flight_cost').notNull(),
  spendCost: integer('spend_cost').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const ratings = sqliteTable('ratings', {
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
}, table => [primaryKey({ columns: [table.tripId, table.userId] })]);
