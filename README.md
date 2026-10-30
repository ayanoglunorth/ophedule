<div align="center">
  <img src="public/favicon.svg" alt="Ophedule logo" width="80" height="80">

  # Ophedule

  **Find dates that work for everyone and compare trip ideas before you book.**

  [Get started](#get-started) · [How it works](#how-it-works) · [Privacy and security](#privacy-and-security)
</div>

Ophedule is a group trip planner for friends. It gives each group a shared room to mark day-by-day availability, set personal round-trip flight budgets, and compare trip ideas side by side. Trip suggestions are ranked automatically by how many people can join, how interested the group is, and what the trip costs.

## Get started

You need Node.js 22.13 or newer and npm. Ophedule runs locally on Vite and Cloudflare's local D1 database simulator.

1. Install dependencies and build the project once so the Worker configuration is generated:

   ```bash
   npm ci
   npm run build
   ```

2. Initialize the local D1 database in `.wrangler/state`:

   ```bash
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_light_gabe_jones.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_aromatic_katie_power.sql
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

The local database lives in `.wrangler/state`, which is ignored by Git. Run the two migration commands only when setting up a fresh local database.

## Plan together

Create a room and copy its invite link from the **Üyeler** tab. An invite link lets a friend send a join request; the room owner approves each request under **Onay bekleyenler** before that person can view or edit the room. The interface is in Turkish.

In the **Takvim** tab, switch to **Benim takvimim**, pick a status (**Uygunum**, **Ayarlayabilirim**, or **Gelemem**), and click or drag across days—or enter a `dd/mm/yyyy` range on the right. Switch to **Ortak takvim** and select any date to see everyone's response grouped by status.

In the **Geziler** tab, each member saves a personal maximum for round-trip airfare under **Uçak bileti bütçen**. Select **Gezi ekle** to propose a trip with `dd/mm/yyyy` departure and return dates, an estimated round-trip flight cost, and per-person spending. Each trip card shows how many members can join, highlights anyone whose flight budget falls short under **Bilet bütçesini aşanlar**, and lets members rate their interest from `0` to `5`. A rating of `0` means the member does not want to join that trip.

## How it works

Ophedule opens a rolling six-month calendar window starting from today's date in `Europe/Istanbul`. Trip ideas must fall within that six-month window.

Trip suggestions are ordered first by the number of eligible members, then by total interest score, confirmed availability (**Uygunum** on every day of the trip), and total estimated cost per person. A member counts as eligible when:

- every date in the trip range is marked,
- no date in the range is marked **Gelemem**,
- they have set a round-trip flight budget and the trip's flight cost does not exceed it, and
- their interest rating is above `0` (unrated trips default to a neutral `3`).

Days marked **Ayarlayabilirim** count toward participation so conditional trips remain visible, but they do not count as confirmed availability.

## Privacy and security

Passwords are hashed with chained PBKDF2-SHA256 before storage, and login checks run equal-cost verification for unknown usernames. Sessions use an HTTP-only cookie, write requests verify the request `Origin`, and all room queries require an approved membership.

Ophedule has no email-based password reset. Flight prices and per-person spending estimates are entered by members rather than fetched from external booking services.

## Development

Run the lint, unit test, and build checks with:

```bash
npm run lint
node --test lib/*.test.ts
npm run build
```

The interface lives in `app/page.tsx` and `app/globals.css`. API handlers live in `app/api/state/route.ts` and `app/api/action/route.ts`, while trip ranking, permission checks, and server helpers live in `lib/`. Database tables are defined in `db/schema.ts`; run `npm run db:generate` after schema changes to generate a new Drizzle migration.
