// ============================================================
//  Spotlight — auth + favorites client (talks to the local API)
//
//  The session token is kept in localStorage and sent as a Bearer header.
//  Favorites live in the account once signed in, so they persist across
//  sign-ins and devices.
// ============================================================
const TOKEN_KEY = "spotlight-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---- auth ----
export async function signup({ email, password, name }) {
  const d = await api("/api/auth/signup", { method: "POST", auth: false, body: { email, password, name } });
  setToken(d.token);
  return d.user;
}

export async function login({ email, password }) {
  const d = await api("/api/auth/login", { method: "POST", auth: false, body: { email, password } });
  setToken(d.token);
  return d.user;
}

export async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch { /* best effort */ }
  setToken("");
}

// returns the signed-in user, or null if no/expired token
export async function me() {
  if (!getToken()) return null;
  try { return (await api("/api/auth/me")).user; }
  catch { setToken(""); return null; }
}

export async function updateProfile({ name, city, homeLat, homeLng }) {
  return (await api("/api/auth/me", { method: "PATCH", body: { name, city, homeLat, homeLng } })).user;
}

// ---- favorites ----
export async function fetchFavorites() {
  return (await api("/api/favorites")).favorites || [];
}

// upload a batch of (guest) favorites, return the merged account list
export async function mergeFavorites(events) {
  return (await api("/api/favorites", { method: "PUT", body: { events } })).favorites || [];
}

export async function addFavorite(event) {
  await api("/api/favorites", { method: "POST", body: event });
}

export async function removeFavorite(id) {
  await api(`/api/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
}
