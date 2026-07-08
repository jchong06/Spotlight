# Spotlight

**[Live demo →](https://spotlight-edm-30822.fly.dev)**

Find live **EDM shows** near you. A mobile-style React app that aggregates real
events from **Ticketmaster** and **SeatGeek**, with a map, date/area filters,
fuzzy artist & venue search, light/dark themes, and favorites.

## Features

- **Live events** aggregated from Ticketmaster + SeatGeek (merged & de-duplicated).
- **EDM-focused** feed with sub-genre filters (House, Techno, Trance, Bass, Festival).
- **Map view** with circular artist-photo pins; tap to preview, tap again for details.
- **Search** artists (date- & location-independent, shows their whole tour on the map),
  venues (upcoming shows), and places.
- **Date & area controls** — presets or a custom range; pan the map and "search this area".
- **Accounts** (Supabase Auth) with per-account **favorites** that sync across devices.
- **Light/dark mode**, and direct **Ticketmaster/SeatGeek** ticket links.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your keys (see below)
npm run dev
```

### Supabase (accounts + favorites)

1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the **Project URL** and **anon public**
   key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the
   `profiles` + `favorites` tables, their row-level-security policies, and a
   trigger that provisions a profile row on signup.
4. (Recommended for the instant sign-in flow) In **Authentication → Providers →
   Email**, turn **off** "Confirm email" — otherwise new users must click an
   email link before they can sign in.

The Supabase URL + anon key are public by design; row-level security is what
scopes each row to its owner.

### External event APIs

Get free keys and add them to `.env`:
- Ticketmaster Discovery API — https://developer.ticketmaster.com
- SeatGeek Platform — https://seatgeek.com/account/develop

These keys are read server-side by the Vite dev proxy (`vite.config.js`) and are
never exposed in the browser bundle.

## Stack

React 18 · Vite · Tailwind CSS v4 · Motion · Leaflet · Supabase
