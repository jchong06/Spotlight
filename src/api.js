// ============================================================
//  SPOTLIGHT — live event data
//
//  Aggregates two real sources through the local proxy (vite.config.js):
//    • Ticketmaster Discovery   (/api/tm)
//    • SeatGeek Platform        (/api/sg)
//
//  fetchEvents({ lat, lng, radiusMiles, startISO, endISO }) returns one
//  merged, de-duplicated, distance-sorted list in the UI's shape.
//  Every event is real and on sale for that place + date window — we
//  never fabricate prices, dates, or venues.
// ============================================================

// ---- geohash (Ticketmaster's geoPoint wants a geohash) ----
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohash(lat, lng, precision = 7) {
  let idx = 0, bit = 0, even = true, hash = "";
  const latR = [-90, 90], lngR = [-180, 180];
  while (hash.length < precision) {
    if (even) {
      const mid = (lngR[0] + lngR[1]) / 2;
      if (lng > mid) { idx = idx * 2 + 1; lngR[0] = mid; } else { idx *= 2; lngR[1] = mid; }
    } else {
      const mid = (latR[0] + latR[1]) / 2;
      if (lat > mid) { idx = idx * 2 + 1; latR[0] = mid; } else { idx *= 2; latR[1] = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += B32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

// ---- haversine distance, miles ----
export function milesBetween(a, b, c, d) {
  const R = 3958.8, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(c - a), dLng = toRad(d - b);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---- formatting helpers ----
function pickImage(images = []) {
  const ok = images.filter((i) => i?.url && !i.fallback);
  const pool = ok.length ? ok : images;
  const wide = pool.filter((i) => i.ratio === "16_9");
  const best = (wide.length ? wide : pool).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  return best?.url || "";
}

function fmtTime(t) {
  if (!t) return "Time TBA";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDate(localDate) {
  if (!localDate) return "Date TBA";
  const [y, mo, d] = localDate.split("-").map(Number);
  const ev = new Date(y, mo - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((ev - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${DAYS[ev.getDay()]}, ${MONTHS[mo - 1]} ${d}`;
}

function isoDay(localDate) {
  const [y, mo, d] = (localDate || "").split("-").map(Number);
  return y ? new Date(y, mo - 1, d).setHours(0, 0, 0, 0) : null;
}

// shared today/live derivation
function timing(localDate, localTime) {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const startMs = isoDay(localDate);
  const ongoing = startMs != null && startMs < todayMs;
  const today = startMs === todayMs;
  let live = false;
  if (today && localTime) {
    const [h, m] = localTime.split(":").map(Number);
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
    live = mins >= -30 && mins <= 240;
  }
  return { ongoing, today, live };
}

// EDM detection — Ticketmaster mis-tags many DJs (Martin Garrix shows up as
// "Electro Pop", Diplo as "Hip-Hop/Rap"), so we match a broad genre regex AND
// a curated headliner allowlist against the title/artist name.
const edmRe =
  /electro|electronic|\bdance\b|\bhouse\b|techno|trance|dubstep|drum\s*&?\s*bass|\bdnb\b|\bbass\b|\bedm\b|hardstyle|progressive|\bgarage\b|big room|future|\brave\b|festival|club dance|disco/i;

export const EDM_ARTISTS = [
  "martin garrix", "tiesto", "tiësto", "david guetta", "calvin harris", "skrillex",
  "deadmau5", "zedd", "marshmello", "illenium", "kaskade", "diplo", "above & beyond",
  "armin van buuren", "swedish house mafia", "alesso", "afrojack", "hardwell",
  "steve aoki", "dimitri vegas", "kygo", "odesza", "flume", "rezz", "excision",
  "subtronics", "john summit", "fisher", "dom dolla", "chris lake", "charlotte de witte",
  "amelie lens", "carl cox", "eric prydz", "disclosure", "rufus du sol", "lane 8",
  "gorgon city", "duke dumont", "peggy gou", "the chainsmokers", "galantis", "gryffin",
  "slander", "seven lions", "louie vega", "honey dijon", "fred again", "the martinez brothers",
  "boys noize", "chris lorenzo", "knock2", "jamie jones", "black coffee", "anyma",
];

// is the typed query a known popular EDM artist? (used to rank search results)
export function isPopularArtist(query) {
  const q = (query || "").toLowerCase().trim();
  if (q.length < 3) return false;
  return EDM_ARTISTS.some((a) => a.includes(q) || q.includes(a));
}

function isEdmEvent(genre, subGenre, title = "", host = "") {
  if (edmRe.test(genre || "") || edmRe.test(subGenre || "")) return true;
  const hay = `${title} ${host}`.toLowerCase();
  return EDM_ARTISTS.some((a) => hay.includes(a));
}

// Ticketmaster/SeatGeek genre tags are unreliable for EDM (Garrix = "Electro
// Pop", Diplo = "Hip-Hop/Rap"), so use a hand-curated style per known artist.
const ARTIST_GENRE = {
  "martin garrix": "Big Room / Progressive House", "tiesto": "Big Room House",
  "tiësto": "Big Room House", "david guetta": "Electro House", "calvin harris": "Electro House",
  "skrillex": "Dubstep", "deadmau5": "Progressive House", "zedd": "Electro House",
  "marshmello": "Future Bass", "illenium": "Melodic Dubstep", "kaskade": "Progressive House",
  "diplo": "EDM / Trap", "above & beyond": "Trance", "armin van buuren": "Trance",
  "swedish house mafia": "Progressive House", "alesso": "Progressive House", "afrojack": "Big Room",
  "hardwell": "Big Room", "steve aoki": "Electro House", "kygo": "Tropical House",
  "odesza": "Electronic", "flume": "Future Bass", "rezz": "Midtempo Bass",
  "excision": "Dubstep", "subtronics": "Riddim Dubstep", "john summit": "Tech House",
  "fisher": "Tech House", "dom dolla": "Tech House", "chris lake": "Tech House",
  "charlotte de witte": "Techno", "amelie lens": "Techno", "carl cox": "Techno",
  "eric prydz": "Progressive House", "disclosure": "UK Garage / House", "rufus du sol": "Melodic House",
  "lane 8": "Melodic House", "gorgon city": "House", "duke dumont": "House", "peggy gou": "House",
  "the chainsmokers": "Future Bass", "galantis": "Future House", "gryffin": "Melodic House",
  "slander": "Melodic Bass", "seven lions": "Melodic Dubstep", "louie vega": "House",
  "honey dijon": "House", "fred again": "Electronic", "the martinez brothers": "Tech House",
  "alan walker": "Electro House", "boys noize": "Techno", "chris lorenzo": "Bass House",
  "knock2": "Bass House", "jamie jones": "Tech House", "black coffee": "Afro House",
  "anyma": "Melodic Techno",
};

function lookupGenre(title = "", host = "", fallback = "") {
  const hay = `${title} ${host}`.toLowerCase();
  const hit = Object.keys(ARTIST_GENRE).find((a) => hay.includes(a));
  return hit ? ARTIST_GENRE[hit] : fallback;
}

function distLabel(dist) {
  return dist == null ? "" : dist < 0.1 ? "nearby" : `${dist.toFixed(1)} mi`;
}

// ============================================================
//  Ticketmaster
// ============================================================
function categoryTM(cl) {
  const seg = (cl?.segment?.name || "").toLowerCase();
  const genre = (cl?.genre?.name || "").toLowerCase();
  if (genre.includes("comedy")) return "comedy";
  if (seg === "music") return "music";
  if (seg === "film") return "film";
  if (seg === "sports") return "sports";
  if (seg.includes("arts")) return "arts";
  return "other";
}

// museum passes / flex admissions / workshops aren't really dated events
const TM_NOISE = /\b(admission|flexi?ticket|flex pass|general admission|day pass|workshop|guided tour|self[- ]guided|exhibit|membership)\b/i;

function normalizeTM(e, center) {
  const cl = (e.classifications || [])[0] || {};
  const venue = (e._embedded?.venues || [])[0] || {};
  const loc = venue.location || {};
  const lat = parseFloat(loc.latitude);
  const lng = parseFloat(loc.longitude);
  const start = e.dates?.start || {};
  const price = (e.priceRanges || [])[0];
  const attraction = (e._embedded?.attractions || [])[0];
  const { ongoing, today, live } = timing(start.localDate, start.localTime);
  const dist = Number.isFinite(lat) && Number.isFinite(lng) ? milesBetween(center.lat, center.lng, lat, lng) : null;

  const attractionName = attraction?.name || "";
  const seg = (cl.segment?.name || "").toLowerCase();
  const isEdm = isEdmEvent(cl.genre?.name, cl.subGenre?.name, e.name, attractionName);
  const noise = ongoing || seg === "miscellaneous" || TM_NOISE.test(e.name || "");

  const tags = [cl.genre?.name, cl.subGenre?.name, cl.segment?.name]
    .filter((t) => t && t !== "Undefined")
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, 3);

  return {
    id: `tm_${e.id}`,
    title: e.name,
    venue: venue.name || "Venue TBA",
    host: attraction?.name || e.promoter?.name || venue.name || "Ticketmaster",
    category: categoryTM(cl),
    isEdm,
    genre: lookupGenre(
      e.name, attractionName,
      cl.genre?.name && cl.genre.name !== "Undefined" ? cl.genre.name : cl.segment?.name || ""
    ),
    date: ongoing ? "Ongoing" : fmtDate(start.localDate),
    rawDate: start.localDate,
    time: start.timeTBA || start.noSpecificTime ? "Time TBA" : fmtTime(start.localTime),
    today,
    live,
    priceNum: price && Number.isFinite(price.min) ? Math.round(price.min) : null,
    priceMax: price && Number.isFinite(price.max) ? Math.round(price.max) : null,
    distance: distLabel(dist),
    distNum: dist,
    source: "Ticketmaster",
    lat,
    lng,
    // prefer the artist/attraction photo over the generic event poster
    img: pickImage(attraction?.images?.length ? attraction.images : e.images),
    url: e.url,
    tmUrl: e.url,
    sgUrl: null,
    bitUrl: null,
    blurb: e.info || e.description || e.pleaseNote ||
      `${e.name}${venue.name ? ` at ${venue.name}` : ""}. Tickets via Ticketmaster.`,
    tags,
    _noise: noise,
  };
}

async function fetchTM({ lat, lng, radiusMiles, startISO, endISO }) {
  // Music segment only, paginated across the whole window — date-sorted results
  // otherwise stop at day one, hiding everything later in the week.
  const PAGE = 199, MAX_PAGES = 4;
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      geoPoint: geohash(lat, lng),
      radius: String(Math.max(1, Math.round(radiusMiles))),
      unit: "miles",
      size: String(PAGE),
      page: String(page),
      sort: "date,asc",
      classificationName: "music",
    });
    if (startISO) params.set("startDateTime", startISO);
    if (endISO) params.set("endDateTime", endISO);
    const res = await fetch(`/api/tm?${params}`);
    if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);
    const data = await res.json();
    out.push(...(data._embedded?.events || []));
    if (page >= (data.page?.totalPages || 1) - 1) break;
  }
  return out.map((e) => normalizeTM(e, { lat, lng }));
}

// ============================================================
//  SeatGeek
// ============================================================
function categorySG(e) {
  const hay = `${e.type || ""} ${(e.taxonomies || []).map((t) => t.name).join(" ")}`.toLowerCase();
  if (hay.includes("comedy")) return "comedy";
  if (hay.includes("sport") || /\b(mlb|nba|nhl|nfl|soccer|mls|tennis|boxing|mma|ufc)\b/.test(hay)) return "sports";
  if (/concert|music|festival/.test(hay)) return "music";
  if (/theater|theatre|broadway|dance|opera|ballet|arts/.test(hay)) return "arts";
  if (hay.includes("film") || hay.includes("movie")) return "film";
  return "other";
}

function normalizeSG(e, center) {
  const v = e.venue || {};
  const loc = v.location || {};
  const lat = loc.lat;
  const lng = loc.lon;
  const perf = (e.performers || [])[0] || {};
  const stats = e.stats || {};
  const localDate = (e.datetime_local || "").slice(0, 10);
  const localTime = (e.datetime_local || "").slice(11, 16);
  const { ongoing, today, live } = timing(localDate, localTime);
  const dist = Number.isFinite(lat) && Number.isFinite(lng) ? milesBetween(center.lat, center.lng, lat, lng) : null;

  const genres = (e.performers || []).flatMap((p) => (p.genres || []).map((g) => (g.name || "").toLowerCase()));
  const genreLabel = lookupGenre(e.title || "", perf.name || "", perf.genres?.[0]?.name || (e.type || "").replace(/_/g, " "));
  const isEdm =
    genres.some((g) => edmRe.test(g)) ||
    isEdmEvent(genreLabel, "", e.title || "", perf.name || "");

  const tags = [...new Set(genres.map((g) => g.replace(/\b\w/g, (c) => c.toUpperCase())))].slice(0, 3);

  const low = Number.isFinite(stats.lowest_price) ? stats.lowest_price : null;
  const high = Number.isFinite(stats.highest_price) ? stats.highest_price : null;

  return {
    id: `sg_${e.id}`,
    title: e.short_title || e.title,
    venue: v.name || "Venue TBA",
    host: perf.name || v.name || "SeatGeek",
    category: categorySG(e),
    isEdm,
    genre: genreLabel,
    date: ongoing ? "Ongoing" : fmtDate(localDate),
    rawDate: localDate,
    time: localTime ? fmtTime(`${localTime}:00`) : "Time TBA",
    today,
    live,
    priceNum: low != null ? Math.round(low) : null,
    priceMax: high != null ? Math.round(high) : null,
    distance: distLabel(dist),
    distNum: dist,
    source: "SeatGeek",
    lat,
    lng,
    img: perf.image || perf.images?.huge || "",
    url: e.url,
    tmUrl: null,
    sgUrl: e.url,
    bitUrl: null,
    blurb: `${e.title} at ${v.name || "the venue"}${v.city ? `, ${v.city}` : ""}. Tickets via SeatGeek.`,
    tags: tags.length ? tags : [genreLabel].filter(Boolean),
    _noise: false,
  };
}

async function fetchSG({ lat, lng, radiusMiles, startISO, endISO }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    range: `${Math.max(1, Math.round(radiusMiles))}mi`,
    per_page: "100",
    sort: "datetime_local.asc",
    type: "concert", // EDM lives under concerts; filtered to EDM after normalizing
  });
  if (startISO) params.set("datetime_utc.gte", startISO.replace("Z", ""));
  if (endISO) params.set("datetime_utc.lte", endISO.replace("Z", ""));
  const res = await fetch(`/api/sg?${params}`);
  if (!res.ok) throw new Error(`SeatGeek ${res.status}`);
  const data = await res.json();
  return (data.events || []).map((e) => normalizeSG(e, { lat, lng }));
}

// ============================================================
//  Bandsintown (artist tours — used to enrich artist search)
// ============================================================
function normalizeBIT(e, center) {
  const v = e.venue || {};
  const lat = parseFloat(v.latitude);
  const lng = parseFloat(v.longitude);
  const localDate = (e.datetime || "").slice(0, 10);
  const localTime = (e.datetime || "").slice(11, 16);
  const { ongoing, today, live } = timing(localDate, localTime);
  const dist = Number.isFinite(lat) && Number.isFinite(lng) ? milesBetween(center.lat, center.lng, lat, lng) : null;
  const artist = (e.lineup || [])[0] || "";
  const offer = (e.offers || []).find((o) => /ticket/i.test(o.type || "")) || (e.offers || [])[0];
  const url = offer?.url || e.url;
  return {
    id: `bit_${e.id}`,
    title: e.title || artist,
    venue: v.name || "Venue TBA",
    host: artist || v.name || "Bandsintown",
    category: "music",
    isEdm: isEdmEvent(lookupGenre(artist), "", artist, ""),
    genre: lookupGenre(artist, "", ""),
    date: ongoing ? "Ongoing" : fmtDate(localDate),
    rawDate: localDate,
    time: localTime ? fmtTime(`${localTime}:00`) : "Time TBA",
    today,
    live,
    priceNum: null,
    priceMax: null,
    distance: distLabel(dist),
    distNum: dist,
    source: "Bandsintown",
    lat,
    lng,
    img: "",
    url,
    tmUrl: null,
    sgUrl: null,
    bitUrl: url,
    blurb: `${artist || e.title} at ${v.name || "the venue"}${v.city ? `, ${v.city}` : ""}. Tickets via Bandsintown.`,
    tags: [],
    _noise: false,
  };
}

async function fetchBIT({ lat, lng, query, startDate, endDate }) {
  try {
    const params = new URLSearchParams({ date: `${startDate},${endDate}` });
    const res = await fetch(`/api/bit/artists/${encodeURIComponent(query.trim())}/events?${params}`);
    if (!res.ok) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => normalizeBIT(e, { lat, lng }));
  } catch {
    return [];
  }
}

// ============================================================
//  Merge
// ============================================================
// same show across sources => same date + overlapping artist tokens. Token
// overlap (ignoring noise words) merges "DJ Hardwell"/"Hardwell" and "Martin
// Garrix"/"Martin Garrix Americas Tour" that key-based matching missed.
const STOP = new Set([
  "dj", "the", "a", "an", "and", "presents", "present", "pres", "tour", "live",
  "feat", "ft", "with", "x", "b2b", "21", "18", "over", "americas", "american",
  "north", "experience", "show", "official", "afterparty", "after", "party", "by",
  "na", "us", "world", "concert", "event",
]);
function sigTokens(e) {
  return `${e.host || ""} ${e.title || ""}`
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}
// true if every token of the smaller set appears in the larger set
function tokensMatch(a, b) {
  if (!a.length || !b.length) return false;
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  return small.every((t) => big.includes(t));
}
// merge same-date shows whose artist tokens overlap (pairwise, n is small)
function dedupeMerge(list) {
  const groups = [];
  for (const e of list) {
    const tok = sigTokens(e);
    const g = groups.find((x) => x.date === (e.rawDate || "") && tokensMatch(x.tokens, tok));
    if (g) g.e = mergeDup(g.e, e);
    else groups.push({ e, tokens: tok, date: e.rawDate || "" });
  }
  return groups.map((g) => g.e);
}

// real TM artist photos live under /dam/a/ ; /dam/c/ & /dam/e/ are generic
// category/event posters (incl. the shared 81eadad8 placeholder) — avoid those.
const isArtistImg = (url) => /\/dam\/a\//.test(url || "");
const cleanArtist = (s) => (s || "").replace(/^\s*dj\s+/i, "").trim();
const normName = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// official Ticketmaster artist photo for a name — picks the attraction that
// actually has a /dam/a/ artist photo (not the generic placeholder). Cached.
const attrImgCache = new Map();
async function tmAttractionImage(name) {
  const key = cleanArtist(name).toLowerCase();
  if (!key) return "";
  if (attrImgCache.has(key)) return attrImgCache.get(key);
  let img = "";
  try {
    const res = await fetch(`/api/attr?${new URLSearchParams({ keyword: cleanArtist(name), size: "8" })}`);
    if (res.ok) {
      const atts = (await res.json())._embedded?.attractions || [];
      const cand = atts.map((a) => ({ name: a.name, url: pickImage(a.images) })).filter((a) => a.url);
      const nk = normName(key);
      const named = cand.filter((a) => normName(a.name) === nk || normName(a.name).includes(nk) || nk.includes(normName(a.name)));
      const pool = named.length ? named : cand;
      img = (pool.find((a) => isArtistImg(a.url)) || pool[0])?.url || "";
    }
  } catch { /* ignore — fall back to whatever image we had */ }
  attrImgCache.set(key, img);
  return img;
}

// Ensure each event uses a real TM artist photo: keep the event's own image if
// it's already a /dam/a/ artist shot (e.g. Diplo), otherwise look the artist up
// and use their canonical photo (fixes generic "DJ Hardwell" / SeatGeek images).
async function enrichArtistImages(result) {
  const need = result.filter((e) => !isArtistImg(e.img));
  const hosts = [...new Set(need.map((e) => cleanArtist(e.host || e.title)).filter(Boolean))];
  const queue = [...hosts];
  const byHost = {};
  const worker = async () => {
    while (queue.length) {
      const h = queue.shift();
      byHost[h.toLowerCase()] = await tmAttractionImage(h);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const e of need) {
    const img = byHost[cleanArtist(e.host || e.title).toLowerCase()];
    if (img) e.img = img;
  }
  return result;
}

// when the same show comes from both sources, the Ticketmaster listing is the
// main one (its name/venue/image win); SeatGeek just adds its price + buy link.
function mergeDup(a, b) {
  const prices = [a.priceNum, b.priceNum].filter((n) => n != null);
  const maxes = [a.priceMax, b.priceMax].filter((n) => n != null);
  const base = [a, b].find((x) => x.source === "Ticketmaster") || (a.priceNum != null ? a : b);
  // always use the Ticketmaster thumbnail when this show is on Ticketmaster
  const tmImg = [a, b].find((x) => x.source === "Ticketmaster" && x.img)?.img;
  return {
    ...base,
    priceNum: prices.length ? Math.min(...prices) : null,
    priceMax: maxes.length ? Math.max(...maxes) : null,
    img: tmImg || base.img || a.img || b.img,
    tmUrl: a.tmUrl || b.tmUrl, // keep every source's buy link for the detail sheet
    sgUrl: a.sgUrl || b.sgUrl,
    bitUrl: a.bitUrl || b.bitUrl,
    url: a.tmUrl || b.tmUrl || a.sgUrl || b.sgUrl || a.bitUrl || b.bitUrl,
    source: a.source === b.source ? a.source : "Multiple sources",
  };
}

export async function fetchEvents({ lat, lng, radiusMiles = 10, startISO, endISO }) {
  const args = { lat, lng, radiusMiles, startISO, endISO };
  const [tm, sg] = await Promise.allSettled([fetchTM(args), fetchSG(args)]);

  if (tm.status === "rejected" && sg.status === "rejected") {
    throw new Error(tm.reason?.message || "Could not load events");
  }
  const all = [
    ...(tm.status === "fulfilled" ? tm.value : []),
    ...(sg.status === "fulfilled" ? sg.value : []),
  ];

  // EDM concerts only. Merge duplicates across sources, taking the lowest seat
  // price found; price shows whenever any source has it, "Tickets" only if none do.
  const filtered = all.filter(
    (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && !e._noise && e.isEdm
  );
  const result = dedupeMerge(filtered).sort((a, b) => {
    const da = a.rawDate || "9999", db = b.rawDate || "9999";
    if (da !== db) return da < db ? -1 : 1;                           // chronological
    return (a.distNum ?? 1e9) - (b.distNum ?? 1e9);
  });

  return enrichArtistImages(result);
}

// ---- artist/keyword search, IGNORING date AND location ----
// searches the artist's whole tour (now → +6 months, no geo filter) so an
// out-of-area artist still surfaces every city they're playing. `center` is
// only used to label how far each show is.
export async function fetchArtistEvents({ lat, lng, query, size = 60 }) {
  if (!query || query.trim().length < 2) return [];
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
  const now = new Date();
  const end = new Date(now); end.setMonth(end.getMonth() + 6);
  const startISO = toISO(now), endISO = toISO(end);

  const tmP = (async () => {
    const params = new URLSearchParams({
      keyword: query, classificationName: "music", size: String(size), sort: "date,asc",
      startDateTime: startISO, endDateTime: endISO,
    });
    const res = await fetch(`/api/tm?${params}`);
    if (!res.ok) throw new Error("tm");
    const d = await res.json();
    return (d._embedded?.events || []).map((e) => normalizeTM(e, { lat, lng }));
  })();

  const sgP = (async () => {
    const params = new URLSearchParams({
      q: query, per_page: String(size), sort: "datetime_local.asc", type: "concert",
      "datetime_utc.gte": startISO.replace("Z", ""), "datetime_utc.lte": endISO.replace("Z", ""),
    });
    const res = await fetch(`/api/sg?${params}`);
    if (!res.ok) throw new Error("sg");
    const d = await res.json();
    return (d.events || []).map((e) => normalizeSG(e, { lat, lng }));
  })();

  const bitP = fetchBIT({ lat, lng, query, startDate: startISO.slice(0, 10), endDate: endISO.slice(0, 10) });

  const [tm, sg, bit] = await Promise.allSettled([tmP, sgP, bitP]);
  const all = [
    ...(tm.status === "fulfilled" ? tm.value : []),
    ...(sg.status === "fulfilled" ? sg.value : []),
    ...(bit.status === "fulfilled" ? bit.value : []),
  ];
  const filtered = all.filter(
    (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && !e._noise
  );
  const result = dedupeMerge(filtered).sort((a, b) =>
    (a.rawDate || "9999") < (b.rawDate || "9999") ? -1 : 1
  );
  return enrichArtistImages(result);
}

// ---- venue search (Ticketmaster) ----
export async function searchVenues(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await fetch(`/api/venues?${new URLSearchParams({ keyword: query.trim(), size: "6", sort: "relevance,desc" })}`);
    if (!res.ok) return [];
    const vs = (await res.json())._embedded?.venues || [];
    return vs
      .map((v) => ({
        id: v.id,
        name: v.name,
        city: [v.city?.name, v.state?.stateCode || v.country?.countryCode].filter(Boolean).join(", "),
        lat: parseFloat(v.location?.latitude),
        lng: parseFloat(v.location?.longitude),
      }))
      .filter((v) => v.name);
  } catch {
    return [];
  }
}

// ---- upcoming events at a specific venue (now → +6 months) ----
export async function fetchVenueEvents({ venueId, center }) {
  if (!venueId) return [];
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
  const now = new Date();
  const end = new Date(now); end.setMonth(end.getMonth() + 6);
  const c = center || { lat: 0, lng: 0 };
  try {
    const params = new URLSearchParams({
      venueId, size: "80", sort: "date,asc",
      startDateTime: toISO(now), endDateTime: toISO(end),
    });
    const res = await fetch(`/api/tm?${params}`);
    if (!res.ok) return [];
    const d = await res.json();
    const list = (d._embedded?.events || [])
      .map((e) => normalizeTM(e, c))
      .filter((e) => !e._noise && Number.isFinite(e.lat) && Number.isFinite(e.lng));
    const result = dedupeMerge(list).sort((a, b) => ((a.rawDate || "9999") < (b.rawDate || "9999") ? -1 : 1));
    return enrichArtistImages(result);
  } catch {
    return [];
  }
}

// ---- forward geocode: search a place by name (OpenStreetMap) ----
// Returns only meaningful places (cities/towns/neighborhoods/landmarks), not
// random streets or POIs, ranked by OSM "importance". `major` flags a clearly
// popular location (big city/region) so it can outrank a same-named venue.
const PLACE_TYPES = new Set([
  "city", "town", "village", "hamlet", "suburb", "neighbourhood", "city_district",
  "borough", "quarter", "state", "county", "country", "region", "municipality",
  "province", "island", "archipelago",
]);
const MAJOR_TYPES = new Set(["city", "town", "state", "country", "county", "municipality", "province", "region"]);

export async function geocodePlace(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&q=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((d) => d.class === "place" || d.class === "boundary" || PLACE_TYPES.has(d.addresstype) || (d.importance || 0) >= 0.55)
      .map((d) => {
        const a = d.address || {};
        const place = a.neighbourhood || a.suburb || a.city_district || a.city || a.town || a.village || a.county || d.name;
        const region = a.state || a.country;
        const imp = d.importance || 0;
        return {
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          label: [place, region].filter(Boolean).join(", ") || d.display_name,
          full: d.display_name,
          importance: imp,
          major: MAJOR_TYPES.has(d.addresstype) || imp >= 0.6,
        };
      })
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 4);
  } catch {
    return [];
  }
}

// ---- best-effort reverse geocode for the area label (OpenStreetMap) ----
export async function areaLabel(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return null;
    const a = (await res.json()).address || {};
    const place =
      a.neighbourhood || a.suburb || a.city_district || a.city || a.town || a.village || a.county;
    const region = a.state_code || a.state || a.country_code?.toUpperCase();
    return [place, region].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}
