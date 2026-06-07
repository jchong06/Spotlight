# Spotlight

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
- **Favorites**, **light/dark mode**, and direct **Ticketmaster/SeatGeek** ticket links.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your keys
npm run dev
```

Get free keys:
- Ticketmaster Discovery API — https://developer.ticketmaster.com
- SeatGeek Platform — https://seatgeek.com/account/develop

Keys are read server-side by the Vite dev proxy (`vite.config.js`) and are never
exposed in the browser bundle.

## Stack

React 18 · Vite · Tailwind CSS v4 · Motion · Leaflet
