// ============================================================
//  Spotlight — external API proxy for production (mirrors vite.config's dev
//  proxy). Injects the secret keys server-side so the browser never sees them.
//  Keys come from env: TM_KEY, SEATGEEK_CLIENT_ID, BANDSINTOWN_APP_ID.
// ============================================================
import https from "node:https";

const TM = process.env.TM_KEY || process.env.VITE_TM_KEY || "";
const SG = process.env.SEATGEEK_CLIENT_ID || "";
const BIT = process.env.BANDSINTOWN_APP_ID || "spotlight-edm";

const ROUTES = [
  { prefix: "/api/tm",     host: "app.ticketmaster.com", base: "/discovery/v2/events.json",      key: ["apikey", TM] },
  { prefix: "/api/attr",   host: "app.ticketmaster.com", base: "/discovery/v2/attractions.json", key: ["apikey", TM] },
  { prefix: "/api/venues", host: "app.ticketmaster.com", base: "/discovery/v2/venues.json",      key: ["apikey", TM] },
  { prefix: "/api/sg",     host: "api.seatgeek.com",     base: "/2/events",                       key: ["client_id", SG] },
  { prefix: "/api/bit",    host: "rest.bandsintown.com", base: "",                                key: ["app_id", BIT] },
];

// Returns true if this request was an external-API route and was proxied.
export function tryProxy(req, res) {
  const u = new URL(req.url, "http://internal");
  const route = ROUTES.find((r) => u.pathname === r.prefix || u.pathname.startsWith(r.prefix + "/"));
  if (!route) return false;

  const rest = u.pathname.slice(route.prefix.length); // e.g. /artists/x/events for bandsintown
  const params = new URLSearchParams(u.search);
  if (route.key[1]) params.set(route.key[0], route.key[1]);
  const path = `${route.base}${rest}?${params.toString()}`;

  const upstream = https.request(
    { host: route.host, path, method: "GET", headers: { accept: "application/json" } },
    (pres) => {
      res.statusCode = pres.statusCode || 502;
      if (pres.headers["content-type"]) res.setHeader("Content-Type", pres.headers["content-type"]);
      pres.pipe(res);
    }
  );
  upstream.on("error", () => {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "Upstream request failed" }));
  });
  upstream.end();
  return true;
}
