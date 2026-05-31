// ============================================================
//  Spotlight — local SQLite store (accounts + saved favorites)
//
//  Uses Node's built-in SQLite (node:sqlite, Node 22.5+), so there are no
//  external DB dependencies. The file lives at server/spotlight.db and is
//  git-ignored. Passwords are scrypt-hashed; sessions are opaque tokens.
// ============================================================
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
// In production set DB_PATH to a persistent volume (e.g. /data/spotlight.db);
// in dev it defaults to a local file next to this module.
const DB_PATH = process.env.DB_PATH || join(here, "spotlight.db");
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    email    TEXT UNIQUE NOT NULL,
    name     TEXT NOT NULL,
    city     TEXT NOT NULL DEFAULT '',
    home_lat REAL,
    home_lng REAL,
    pw_hash  TEXT NOT NULL,
    pw_salt  TEXT NOT NULL,
    created  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token    TEXT PRIMARY KEY,
    user_id  INTEGER NOT NULL,
    created  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id  INTEGER NOT NULL,
    event_id TEXT NOT NULL,
    data     TEXT NOT NULL,
    created  TEXT NOT NULL,
    PRIMARY KEY (user_id, event_id)
  );
`);

// migrate older DBs that predate the home-coordinate columns
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userCols.includes("home_lat")) db.exec("ALTER TABLE users ADD COLUMN home_lat REAL");
if (!userCols.includes("home_lng")) db.exec("ALTER TABLE users ADD COLUMN home_lng REAL");

const nowISO = () => new Date().toISOString();

// ---- password hashing (scrypt) ----
function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}
function passwordMatches(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const publicUser = (u) =>
  u ? { id: u.id, email: u.email, name: u.name, city: u.city, homeLat: u.home_lat ?? null, homeLng: u.home_lng ?? null } : null;

// ---- users ----
export function createUser({ email, password, name }) {
  const { hash, salt } = hashPassword(password);
  const info = db
    .prepare("INSERT INTO users (email, name, city, pw_hash, pw_salt, created) VALUES (?, ?, '', ?, ?, ?)")
    .run(email.toLowerCase(), name, hash, salt, nowISO());
  return getUserById(info.lastInsertRowid);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
}

export function verifyCredentials(email, password) {
  const u = getUserByEmail(email);
  if (!u || !passwordMatches(password, u.pw_salt, u.pw_hash)) return null;
  return u;
}

export function updateUser(id, { name, city, homeLat, homeLng }) {
  const u = getUserById(id);
  if (!u) return null;
  db.prepare("UPDATE users SET name = ?, city = ?, home_lat = ?, home_lng = ? WHERE id = ?").run(
    name != null ? name : u.name,
    city != null ? city : u.city,
    homeLat !== undefined ? homeLat : u.home_lat,   // undefined = leave unchanged; null = clear
    homeLng !== undefined ? homeLng : u.home_lng,
    id
  );
  return getUserById(id);
}

// ---- sessions ----
export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created) VALUES (?, ?, ?)").run(token, userId, nowISO());
  return token;
}

export function userForToken(token) {
  if (!token) return null;
  const s = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token);
  return s ? getUserById(s.user_id) : null;
}

export function deleteSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ---- favorites (stored as full event JSON blobs, keyed by event id) ----
export function listFavorites(userId) {
  return db
    .prepare("SELECT data FROM favorites WHERE user_id = ? ORDER BY created DESC")
    .all(userId)
    .map((r) => {
      try { return JSON.parse(r.data); } catch { return null; }
    })
    .filter(Boolean);
}

export function upsertFavorite(userId, event) {
  if (!event || !event.id) return;
  db.prepare(
    `INSERT INTO favorites (user_id, event_id, data, created) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, event_id) DO UPDATE SET data = excluded.data`
  ).run(userId, event.id, JSON.stringify(event), nowISO());
}

export function removeFavorite(userId, eventId) {
  db.prepare("DELETE FROM favorites WHERE user_id = ? AND event_id = ?").run(userId, eventId);
}

export { publicUser };
