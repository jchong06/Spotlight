// ============================================================
//  Spotlight — auth + favorites client (Supabase)
//
//  Auth is handled by Supabase Auth (email + password); the session is stored
//  and refreshed by supabase-js in localStorage. Profile fields (name, home
//  city + coordinates) live in the `profiles` table, and saved shows live in
//  `favorites` as full event JSON blobs keyed by (user, event id). Row-level
//  security scopes every row to the signed-in user — see supabase/schema.sql.
//
//  The exported surface matches what the app expects: {id,email,name,city,
//  homeLat,homeLng} user objects, and favorites as arrays of event objects.
// ============================================================
import { supabase } from "./supabaseClient.js";

export function isDemoMode() {
  return String(import.meta.env.VITE_DEMO_MODE ?? "").toLowerCase() === "true";
}

function loadDemoProfile() {
  try {
    return JSON.parse(localStorage.getItem("spotlight-demo-profile") || "{}") || {};
  } catch {
    return {};
  }
}

export function getDemoUser() {
  const profile = loadDemoProfile();
  return {
    id: "demo-user",
    email: "demo@spotlight.app",
    name: profile.name || "Demo User",
    city: profile.city || "Brooklyn",
    homeLat: profile.homeLat ?? profile.home_lat ?? null,
    homeLng: profile.homeLng ?? profile.home_lng ?? null,
  };
}

// shape a Supabase auth user + profile row into the app's user object
async function toUser(authUser) {
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, city, home_lat, home_lng")
    .eq("id", authUser.id)
    .maybeSingle();
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || authUser.user_metadata?.name || "",
    city: profile?.city || "",
    homeLat: profile?.home_lat ?? null,
    homeLng: profile?.home_lng ?? null,
  };
}

const currentUser = async () => (await supabase.auth.getUser()).data.user || null;

// ---- auth ----
export async function signup({ email, password, name }) {
  if (isDemoMode()) return getDemoUser();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }, // seeds the profile row via the DB trigger
  });
  if (error) throw new Error(error.message);
  // With "Confirm email" enabled in Supabase, signUp returns no session — the
  // user must click the email link before they can sign in.
  if (!data.session) {
    throw new Error("Check your email to confirm your account, then sign in.");
  }
  return toUser(data.user);
}

export async function login({ email, password }) {
  if (isDemoMode()) return getDemoUser();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return toUser(data.user);
}

export async function logout() {
  if (isDemoMode()) return;
  await supabase.auth.signOut();
}

// returns the signed-in user, or null if there's no active session
export async function me() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return toUser(data.session.user);
  if (isDemoMode()) return getDemoUser();
  return null;
}

export async function updateProfile({ name, city, homeLat, homeLng }) {
  const user = await currentUser();
  if (!user) {
    if (isDemoMode()) {
      const base = getDemoUser();
      const next = {
        ...base,
        ...(name !== undefined ? { name } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(homeLat !== undefined ? { homeLat } : {}),
        ...(homeLng !== undefined ? { homeLng } : {}),
      };
      localStorage.setItem("spotlight-demo-profile", JSON.stringify({
        name: next.name,
        city: next.city,
        homeLat: next.homeLat ?? null,
        homeLng: next.homeLng ?? null,
      }));
      return next;
    }
    throw new Error("Not signed in");
  }
  // only send the fields that were provided; undefined = leave unchanged
  const patch = { id: user.id };
  if (name !== undefined) patch.name = name;
  if (city !== undefined) patch.city = city;
  if (homeLat !== undefined) patch.home_lat = homeLat;
  if (homeLng !== undefined) patch.home_lng = homeLng;
  const { error } = await supabase.from("profiles").upsert(patch);
  if (error) throw new Error(error.message);
  return toUser(user);
}

// ---- favorites ----
export async function fetchFavorites() {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("favorites")
    .select("data")
    .eq("user_id", user.id)
    .order("created", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.data).filter(Boolean);
}

// upload a batch of (guest) favorites, return the merged account list
export async function mergeFavorites(events) {
  const user = await currentUser();
  if (!user) return [];
  const rows = (events || [])
    .filter((e) => e?.id)
    .map((e) => ({ user_id: user.id, event_id: e.id, data: e }));
  if (rows.length) {
    const { error } = await supabase
      .from("favorites")
      .upsert(rows, { onConflict: "user_id,event_id" });
    if (error) throw new Error(error.message);
  }
  return fetchFavorites();
}

export async function addFavorite(event) {
  const user = await currentUser();
  if (!user || !event?.id) return;
  const { error } = await supabase
    .from("favorites")
    .upsert({ user_id: user.id, event_id: event.id, data: event }, { onConflict: "user_id,event_id" });
  if (error) throw new Error(error.message);
}

export async function removeFavorite(eventId) {
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
}
