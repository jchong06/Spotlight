// ============================================================
//  SPOTLIGHT — config + helpers
//  Live events come from the Ticketmaster Discovery API (see api.js).
//  This file only holds UI config: the default location, the
//  category chips, the date presets, and small formatters.
// ============================================================

// where the map opens before you pan it
export const DEFAULT_CENTER = { lat: 40.706, lng: -73.965, label: "Brooklyn, NY" };

// the feed is EDM-only; these chips refine by sub-style (best-effort match)
export const categories = [
  { id: "all", label: "All EDM", icon: "✶" },
  { id: "house", label: "House", icon: "◑" },
  { id: "dubstep", label: "Dubstep", icon: "≋" },
  { id: "melodic", label: "Melodic", icon: "✧" },
  { id: "bass", label: "Bass", icon: "♬" },
  { id: "trance", label: "Trance", icon: "✦" },
];

// Each chip matches a set of genre keywords. Kept as explicit lists (not one
// loose regex) so e.g. "Progressive House" lands under House and "Melodic
// Dubstep" shows under both Melodic and Dubstep. Buckets intentionally overlap.
const SUBGENRE = {
  // tech/deep/future/electro/tropical/afro/bass/progressive house all contain "house"
  house: ["house", "big room", "disco", "garage", "bassline"],
  dubstep: ["dubstep", "riddim", "brostep", "wobble"],
  melodic: ["melodic", "melody", "progressive house", "future bass"],
  bass: ["bass", "dubstep", "drum & bass", "drum and bass", "dnb", "riddim", "trap", "midtempo", "hardstyle"],
  trance: ["trance", "uplifting", "psytrance", "progressive trance"],
};

export function matchSub(event, id) {
  if (id === "all" || !SUBGENRE[id]) return true;
  const hay = `${event.genre || ""} ${(event.tags || []).join(" ")} ${event.title || ""} ${event.venue || ""}`.toLowerCase();
  return SUBGENRE[id].some((kw) => hay.includes(kw));
}

export const priceLabel = (min, max) =>
  min == null
    ? "Tickets"
    : min === 0
    ? "Free"
    : max != null && max > min
    ? `$${min}+`
    : `$${min}`;

// ---- date presets ----------------------------------------------------
// each returns { startISO, endISO } in UTC (what Ticketmaster wants)
const pad = (n) => String(n).padStart(2, "0");
const toUTC = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;

function dayRange(start, end) {
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  // end ~6am the morning after, so after-midnight sets on the last day still
  // fall inside the UTC window (a Fri-night rave is technically Sat 1am UTC-wise)
  const e = new Date(end); e.setHours(29, 59, 59, 0);
  // never ask for events in the past
  const now = new Date();
  if (s < now) s.setTime(now.getTime());
  return { startISO: toUTC(s), endISO: toUTC(e) };
}

export const DATE_PRESETS = [
  {
    id: "today",
    label: "Today",
    short: "Today",
    make: () => { const d = new Date(); return dayRange(d, d); },
  },
  {
    id: "tomorrow",
    label: "Tomorrow",
    short: "Tomorrow",
    make: () => { const d = new Date(); d.setDate(d.getDate() + 1); return dayRange(d, d); },
  },
  {
    id: "weekend",
    label: "This weekend",
    short: "Weekend",
    make: () => {
      const d = new Date();
      const fri = new Date(d); fri.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
      const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
      return dayRange(fri, sun);
    },
  },
  {
    id: "week",
    label: "This week",
    short: "Week",
    make: () => { const d = new Date(); const e = new Date(d); e.setDate(d.getDate() + 7); return dayRange(d, e); },
  },
];

// range for a single calendar day
export function rangeForDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const { startISO, endISO } = dayRange(day, day);
  const label = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return { id: "custom", label, startISO, endISO, date: yyyyMmDd, endDate: yyyyMmDd };
}

// range across two calendar days (inclusive); pass equal days for a single day
export function rangeForDates(startYmd, endYmd) {
  if (!endYmd || endYmd === startYmd) return rangeForDate(startYmd);
  const [y1, m1, d1] = startYmd.split("-").map(Number);
  const [y2, m2, d2] = endYmd.split("-").map(Number);
  const s = new Date(y1, m1 - 1, d1);
  const e = new Date(y2, m2 - 1, d2);
  const { startISO, endISO } = dayRange(s, e);
  const fmt = (dt) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { id: "custom", label: `${fmt(s)} – ${fmt(e)}`, startISO, endISO, date: startYmd, endDate: endYmd };
}
