# Ophedule

Ophedule helps a group find dates for a trip, compare ideas, and see who can join.

## How it works

Create a room and send its invite link to your friends. The room owner approves each request before that person can see the room. Members mark days as available, possible, or unavailable. The shared calendar shows the responses for each date.

In the Trips tab, members can add dates, an estimated round-trip flight cost, and other per-person spending. Each person sets a maximum flight budget. Ophedule shows how many people can join each trip and names anyone whose flight budget falls short. Members can also rate a trip from 0 to 5; a rating of 0 means they do not want to join it.

Trip suggestions are ordered by the number of eligible members, then by interest, confirmed availability, and estimated cost. A member counts as eligible when every trip date is marked, no date is unavailable, the flight cost fits their budget, and their interest rating is above 0. Days marked as possible count toward participation but not confirmed availability.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_light_gabe_jones.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_aromatic_katie_power.sql
npm run dev
```

The local database lives in `.wrangler/state`, which is ignored by Git. Run the two migration commands only when setting up a fresh local database. To generate a migration after changing `db/schema.ts`, run `npm run db:generate`.

## Checks

```bash
npm run lint
node --test lib/*.test.ts
npm run build
```

## Stack and deployment

The interface uses React, TypeScript, and Vinext. Cloudflare Workers serves the app, and D1 stores accounts, rooms, availability, trips, and ratings. The deployment binding is named `DB`; `.openai/hosting.json` records the Sites project and binding configuration. Set its `project_id` to your own Sites project before publishing a copy.

Passwords are hashed before storage. Sessions use an HTTP-only cookie, and write requests check the request origin. Room data requires an approved membership. Invite links let a person request access; they do not grant it automatically.

The app has no email-based password reset. Flight prices and spending estimates are entered by members rather than fetched from a booking service.
