import { useEffect, useRef, useState } from "react";
import { updateProfile } from "../auth.js";
import { geocodePlace } from "../api.js";

// notification preference is a local UI setting; the account itself lives in the DB
const LS = { prefs: "spotlight-prefs" };

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v && typeof v === "object" && !Array.isArray(v) ? { ...fallback, ...v } : fallback;
  } catch { return fallback; }
}

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// shared pill switch
function Switch({ on, onChange, label }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative h-8 w-[58px] shrink-0 rounded-full transition-colors ${on ? "accent-grad" : "bg-bg-3"}`}
    >
      <span
        className={`absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-ink shadow transition-all ${
          on ? "left-[30px]" : "left-1"
        }`}
      >
        {label === "theme" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            {on ? (
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            ) : (
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        ) : null}
      </span>
    </button>
  );
}

function SectionLabel({ children }) {
  return <p className="mb-2 ml-1 mt-6 text-[12px] font-bold uppercase tracking-wider text-ink-3">{children}</p>;
}

// Typeahead city picker. Searches places as you type (OpenStreetMap geocoder,
// the same one the map search uses) and reports the chosen place's coordinates
// up via onPick. Typing freely clears the coords until a suggestion is chosen.
function CityField({ value, onPick }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const skip = useRef(false); // skip the search cycle triggered by our own pick

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    const q = (value || "").trim();
    if (q.length < 3) { setResults([]); setOpen(false); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const places = await geocodePlace(q);
      setResults(places);
      setOpen(true);
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [value]);

  const choose = (p) => {
    skip.current = true;
    onPick({ label: p.label, lat: p.lat, lng: p.lng });
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl bg-bg-2 px-3 py-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
          <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <input
          value={value}
          onChange={(e) => onPick({ label: e.target.value, lat: null, lng: null })}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search your city"
          className="w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-3"
        />
        {loading && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ink-3/40 border-t-ink-3" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-bg shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(r)}
              className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-bg-2 ${
                i < results.length - 1 ? "border-b border-line-soft" : ""
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-ink-3">
                <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-ink">{r.label}</span>
                <span className="block truncate text-[12px] text-ink-3">{r.full}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Profile({ theme, onToggleTheme, user, onOpenAuth, onLogout, onUserChange }) {
  const [prefs, setPrefs] = useState(() => load(LS.prefs, { notifications: true }));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { localStorage.setItem(LS.prefs, JSON.stringify(prefs)); }, [prefs]);

  const startEdit = () => {
    setDraft({ name: user.name, city: user.city || "", homeLat: user.homeLat ?? null, homeLng: user.homeLng ?? null });
    setErr("");
    setEditing(true);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErr("");
    try {
      const city = draft.city.trim();
      let { homeLat, homeLng } = draft;
      // typed a city but didn't tap a suggestion — resolve its coordinates now
      if (city && (homeLat == null || homeLng == null)) {
        const hits = await geocodePlace(city);
        if (hits[0]) { homeLat = hits[0].lat; homeLng = hits[0].lng; }
      }
      if (!city) { homeLat = null; homeLng = null; } // cleared city clears the home location
      const updated = await updateProfile({ name: draft.name.trim() || user.name, city, homeLat, homeLng });
      onUserChange?.(updated);
      setEditing(false);
    } catch (e) {
      setErr(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const dark = theme === "dark";

  return (
    <div className="px-4 pb-28 pt-4">
      <h1 className="font-display mb-5 text-[30px] font-bold tracking-tight text-ink">Profile</h1>

      {/* identity / sign-in */}
      {!user ? (
        <button
          onClick={onOpenAuth}
          className="card mb-1 flex w-full items-center gap-4 rounded-3xl p-4 text-left active:scale-[0.99]"
        >
          <div className="accent-grad glow grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[18px] font-extrabold text-ink">Sign in or create account</div>
            <div className="text-[14px] text-ink-3">Save your favorites and keep them across sign-ins.</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="ml-auto shrink-0 text-ink-3">
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="card mb-1 rounded-3xl p-4">
          <div className="flex items-center gap-4">
            <div className="accent-grad glow grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-extrabold text-white">
              {initialsOf(editing ? draft.name : user.name)}
            </div>
            {!editing ? (
              <>
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-extrabold text-ink">{user.name}</div>
                  <div className="truncate text-[14px] text-ink-3">
                    {[user.city, user.email].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button
                  onClick={startEdit}
                  aria-label="Edit profile"
                  className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-2 text-ink active:scale-90"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            ) : (
              <div className="flex-1 text-[13px] font-semibold text-ink-3">Editing profile</div>
            )}
          </div>

          {editing && (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-3">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full rounded-xl bg-bg-2 px-3 py-2.5 text-[15px] font-medium text-ink outline-none ring-accent/40 focus:ring-2"
                />
              </label>
              <div className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-3">Home city · sets your default map area</span>
                <CityField
                  value={draft.city}
                  onPick={({ label, lat, lng }) => setDraft((d) => ({ ...d, city: label, homeLat: lat, homeLng: lng }))}
                />
              </div>
              <div className="rounded-xl bg-bg-2 px-3 py-2.5 text-[13px] text-ink-3">
                Signed in as <span className="font-semibold text-ink-2">{user.email}</span>
              </div>
              {err && <p className="px-1 text-[13px] font-medium text-rose-500">{err}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="accent-grad flex-1 rounded-xl py-2.5 text-[14px] font-bold text-white active:scale-95 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-xl bg-bg-2 py-2.5 text-[14px] font-bold text-ink active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* preferences */}
      <SectionLabel>Preferences</SectionLabel>
      <div className="card overflow-hidden rounded-3xl">
        <div className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg-2 text-ink">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              {dark ? (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>
              )}
            </svg>
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">Appearance</div>
            <div className="text-[13px] text-ink-3">{dark ? "Dark" : "Light"} mode</div>
          </div>
          <Switch on={dark} onChange={onToggleTheme} label="theme" />
        </div>

        <div className="flex items-center gap-4 px-4 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg-2 text-ink">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm3 9a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">Event reminders</div>
            <div className="text-[13px] text-ink-3">Notify me about saved shows</div>
          </div>
          <Switch
            on={prefs.notifications}
            onChange={() => setPrefs((s) => ({ ...s, notifications: !s.notifications }))}
            label="notifications"
          />
        </div>
      </div>

      {/* help */}
      <SectionLabel>Support</SectionLabel>
      <div className="card overflow-hidden rounded-3xl">
        <a
          href="mailto:hello@spotlight.app?subject=Spotlight%20help"
          className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-bg-2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg-2 text-ink">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 15v.01M12 13a2.5 2.5 0 1 0-2.5-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="flex-1 text-[15px] font-medium text-ink">Help center</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-ink-3">
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      {/* log out */}
      {user && (
        <button
          onClick={onLogout}
          className="card mt-6 flex w-full items-center justify-center gap-2 rounded-3xl py-4 text-[15px] font-bold text-rose-500 active:scale-[0.99]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Log out
        </button>
      )}

      <p className="mt-6 text-center text-[12px] text-ink-3">
        Spotlight · {user?.city || "Brooklyn"} · v0.3
      </p>
    </div>
  );
}
