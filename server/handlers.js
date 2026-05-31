// ============================================================
//  Spotlight — auth + favorites route handlers (shared)
//
//  Used by both the Vite dev plugin (server/api-plugin.js) and the standalone
//  production server (server/index.js). Each handler receives the Node req/res
//  plus `path` = the sub-path after its base (e.g. "/login", "/me", "/:id").
// ============================================================
import * as db from "./db.js";

export function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve(null); } // null = malformed
    });
    req.on("error", () => resolve(null));
  });
}

const bearer = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- /api/auth/* ----
export async function authRoutes(req, res, path) {
  try {
    if (req.method === "POST" && path === "/signup") {
      const body = await readJson(req);
      if (!body) return send(res, 400, { error: "Bad request" });
      const email = String(body.email || "").trim();
      const name = String(body.name || "").trim();
      const password = String(body.password || "");
      if (!EMAIL_RE.test(email)) return send(res, 400, { error: "Enter a valid email" });
      if (!name) return send(res, 400, { error: "Name is required" });
      if (password.length < 6) return send(res, 400, { error: "Password must be at least 6 characters" });
      if (db.getUserByEmail(email)) return send(res, 409, { error: "An account with that email already exists" });
      const user = db.createUser({ email, password, name });
      const token = db.createSession(user.id);
      return send(res, 201, { token, user: db.publicUser(user) });
    }

    if (req.method === "POST" && path === "/login") {
      const body = await readJson(req);
      if (!body) return send(res, 400, { error: "Bad request" });
      const user = db.verifyCredentials(body.email || "", body.password || "");
      if (!user) return send(res, 401, { error: "Incorrect email or password" });
      const token = db.createSession(user.id);
      return send(res, 200, { token, user: db.publicUser(user) });
    }

    if (req.method === "POST" && path === "/logout") {
      db.deleteSession(bearer(req));
      return send(res, 200, { ok: true });
    }

    if ((req.method === "GET" || req.method === "PATCH") && path === "/me") {
      const user = db.userForToken(bearer(req));
      if (!user) return send(res, 401, { error: "Not signed in" });
      if (req.method === "PATCH") {
        const body = await readJson(req);
        if (!body) return send(res, 400, { error: "Bad request" });
        const num = (v) => (v === null ? null : v === undefined ? undefined : Number(v));
        const updated = db.updateUser(user.id, {
          name: body.name != null ? String(body.name).trim() || user.name : undefined,
          city: body.city != null ? String(body.city).trim() : undefined,
          homeLat: num(body.homeLat),
          homeLng: num(body.homeLng),
        });
        return send(res, 200, { user: db.publicUser(updated) });
      }
      return send(res, 200, { user: db.publicUser(user) });
    }

    return send(res, 404, { error: "Not found" });
  } catch (e) {
    return send(res, 500, { error: e.message || "Server error" });
  }
}

// ---- /api/favorites/* (all require a valid token) ----
export async function favoritesRoutes(req, res, path) {
  try {
    const user = db.userForToken(bearer(req));
    if (!user) return send(res, 401, { error: "Not signed in" });

    if (req.method === "GET") {
      return send(res, 200, { favorites: db.listFavorites(user.id) });
    }
    if (req.method === "PUT") {
      const body = await readJson(req);
      if (!body) return send(res, 400, { error: "Bad request" });
      for (const ev of body.events || []) db.upsertFavorite(user.id, ev);
      return send(res, 200, { favorites: db.listFavorites(user.id) });
    }
    if (req.method === "POST") {
      const event = await readJson(req);
      if (!event || !event.id) return send(res, 400, { error: "Bad request" });
      db.upsertFavorite(user.id, event);
      return send(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      const id = decodeURIComponent((path || "").replace(/^\//, ""));
      if (!id) return send(res, 400, { error: "Missing id" });
      db.removeFavorite(user.id, id);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return send(res, 500, { error: e.message || "Server error" });
  }
}
