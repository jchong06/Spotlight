import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Explore from "./screens/Explore.jsx";
import Saved from "./screens/Saved.jsx";
import Profile from "./screens/Profile.jsx";
import Auth from "./screens/Auth.jsx";
import EventDetail from "./components/EventDetail.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { fetchEvents, areaLabel } from "./api.js";
import { DEFAULT_CENTER, DATE_PRESETS } from "./data.js";
import { me, logout, fetchFavorites, mergeFavorites, addFavorite, removeFavorite } from "./auth.js";

const favsToMap = (list) => (list || []).reduce((m, e) => { if (e?.id) m[e.id] = e; return m; }, {});

const TABS = [
  {
    id: "explore",
    label: "Explore",
    icon: (a) => (
      <>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9} fill="none" />
        <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9} strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "saved",
    label: "Favorites",
    icon: (a) => (
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        stroke="currentColor"
        strokeWidth={a ? 0 : 1.8}
        fill={a ? "currentColor" : "none"}
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (a) => (
      <>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9} fill="none" />
        <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9} fill="none" strokeLinecap="round" />
      </>
    ),
  },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-7 pt-3 pb-1 text-ink">
      <span className="text-[14px] font-bold tracking-tight">10:48</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="7" width="3" height="5" rx="1" />
          <rect x="4.5" y="4.5" width="3" height="7.5" rx="1" />
          <rect x="9" y="2" width="3" height="10" rx="1" />
          <rect x="13.5" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 10.5C5 7.5 1.5 6 1.5 6S5 2 8 2s6.5 4 6.5 4-3.5 4.5-6.5 4.5Z" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="6" r="1.5" fill="currentColor" />
        </svg>
        <div className="h-3 w-6 rounded-[3px] border border-ink/70 p-[1.5px]">
          <div className="h-full w-4/5 rounded-[1px] bg-ink" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("explore");
  const [openEvent, setOpenEvent] = useState(null);
  const [exploreView, setExploreView] = useState("list"); // 'list' | 'map'

  // condense the map button + tab bar while scrolling down, restore on scroll up
  // (or at the top) so more of the list is visible. Small hysteresis avoids
  // flicker on tiny scroll jitters.
  const [condensed, setCondensed] = useState(false);
  const lastScrollY = useRef(0);
  const bodyRef = useRef(null);
  const onBodyScroll = (e) => {
    const y = e.currentTarget.scrollTop;
    const last = lastScrollY.current;
    if (y <= 8) setCondensed(false);
    else if (y > last + 6) setCondensed(true);
    else if (y < last - 6) setCondensed(false);
    lastScrollY.current = y;
  };
  // reset when the surface changes (tab switch / list↔map): un-condense AND
  // scroll the shared container back to top, so a short page (Favorites/Profile)
  // isn't left scrolled past its content (which looked like a blank page).
  useEffect(() => {
    setCondensed(false);
    lastScrollY.current = 0;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab, exploreView]);

  // theme — persisted, applied to <html> so the whole tree + page bg flip
  const [theme, setTheme] = useState(() => localStorage.getItem("spotlight-theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("spotlight-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // artist "tour" override — when set, the map shows the artist's shows across
  // all cities (not the local feed) and zooms out to fit them
  const [tourEvents, setTourEvents] = useState(null);

  // switching between list and map closes the detail sheet AND exits tour mode,
  // so "List" returns to the normal area feed
  const goToView = (v) => { setExploreView(v); setOpenEvent(null); setTourEvents(null); };

  // show an artist's whole tour on the map, zoomed to fit
  const showArtist = useCallback((evs) => {
    if (!evs?.length) return;
    setTourEvents(evs);
    setOpenEvent(null);
    setExploreView("map");
  }, []);

  // ---- query state: where + when ----
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(12); // miles
  const [dateRange, setDateRange] = useState(() => {
    const p = DATE_PRESETS.find((x) => x.id === "week");
    return { id: p.id, label: p.label, ...p.make() };
  });

  // ---- results ----
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- account ---- (the whole app is gated behind sign-in)
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); // false until we've checked for a session

  // ---- favorites: full event objects. localStorage is the guest store + an
  // offline cache; once signed in the account (SQLite) is the source of truth. ----
  const [savedMap, setSavedMap] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("spotlight-favorites") || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("spotlight-favorites", JSON.stringify(savedMap)); } catch { /* ignore */ }
  }, [savedMap]);
  const isSaved = (id) => Object.prototype.hasOwnProperty.call(savedMap, id);
  const toggleSave = (event) =>
    setSavedMap((prev) => {
      const next = { ...prev };
      const removing = !!next[event.id];
      if (removing) delete next[event.id];
      else next[event.id] = event;
      // write through to the account when signed in (best effort, non-blocking)
      if (user) (removing ? removeFavorite(event.id) : addFavorite(event)).catch(() => {});
      return next;
    });

  // center the feed + map on the account's saved home city, when set
  const applyHome = useCallback((u) => {
    if (u && Number.isFinite(u.homeLat) && Number.isFinite(u.homeLng)) {
      setRadius(15);
      setCenter({ lat: u.homeLat, lng: u.homeLng, label: u.city || "Home" });
    }
  }, []);

  // updating the profile (e.g. changing home city) re-centers the map too
  const handleUserChange = useCallback((u) => {
    setUser(u);
    applyHome(u);
  }, [applyHome]);

  // restore an existing session on load, then pull the account's saved shows
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        if (u) {
          setUser(u);
          applyHome(u);
          try { setSavedMap(favsToMap(await fetchFavorites())); } catch { /* keep cache */ }
        }
      } finally {
        setAuthReady(true);
      }
    })();
  }, [applyHome]);

  // after sign-in/sign-up: merge any local favorites into the account, then
  // adopt the merged list so nothing is lost
  const handleAuthed = useCallback(async (u) => {
    setUser(u);
    applyHome(u);
    try {
      const local = Object.values(savedMap);
      const merged = local.length ? await mergeFavorites(local) : await fetchFavorites();
      setSavedMap(favsToMap(merged));
    } catch { /* keep whatever we have */ }
  }, [savedMap, applyHome]);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setSavedMap({}); // account favorites stay in the DB; clear the local view
  }, []);

  // fetch whenever the location, radius, or date window changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTourEvents(null); // any area/date change exits artist-tour mode
    fetchEvents({
      lat: center.lat,
      lng: center.lng,
      radiusMiles: radius,
      startISO: dateRange.startISO,
      endISO: dateRange.endISO,
    })
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch((e) => {
        if (!cancelled) { setError(e.message || "Could not load events"); setEvents([]); }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [center.lat, center.lng, radius, dateRange.startISO, dateRange.endISO]);

  // when a place is searched: recenter on it and refresh
  const searchPlace = useCallback(({ lat, lng, label }) => {
    setRadius(15);
    setCenter({ lat, lng, label });
  }, []);

  // when the map is panned: move the search center, refresh, relabel
  const searchArea = useCallback(({ lat, lng, radiusMiles }) => {
    setRadius(Math.min(60, Math.max(2, Math.round(radiusMiles))));
    setCenter((prev) => ({ lat, lng, label: prev.label }));
    areaLabel(lat, lng).then((label) => {
      if (label) setCenter((prev) => ({ ...prev, label }));
    });
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-canvas lg:px-4 lg:py-10">
      {/* ---- glowing aurora stage ---- */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute right-[-12%] top-[-12%] h-[60%] w-[55%] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--c-accent), transparent 68%)", opacity: 0.32 }}
        />
        <div
          className="absolute bottom-[-16%] left-[-12%] h-[60%] w-[55%] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--c-accent-3), transparent 68%)", opacity: 0.26 }}
        />
        <div
          className="absolute left-1/3 top-1/4 h-[40%] w-[40%] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--c-accent-2), transparent 70%)", opacity: 0.14 }}
        />
      </div>

      {/* ---- side caption (desktop only) ---- */}
      <div className="pointer-events-none absolute left-12 top-1/2 hidden max-w-sm -translate-y-1/2 lg:block">
        <div className="flex items-center gap-2.5">
          <span className="accent-grad glow grid h-8 w-8 place-items-center rounded-xl text-sm font-extrabold text-white">S</span>
          <span className="text-[13px] font-extrabold uppercase tracking-[0.3em] text-ink">Spotlight</span>
        </div>
        <h2 className="font-display mt-6 text-[56px] font-bold leading-[0.98] tracking-tight text-ink">
          Every set,<br />every night,<br />
          <span className="accent-text">near you.</span>
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
          Live EDM shows aggregated from Ticketmaster and SeatGeek — pick a date, pan the map to any
          area, and see every DJ and dance show actually playing there.
        </p>
      </div>

      {/* ---- device ---- */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative z-10 w-full lg:w-auto"
      >
        {/* full-screen on phones; framed device mockup on larger screens */}
        <div
          className="relative w-full bg-bg p-0 lg:w-[392px] lg:max-w-[92vw] lg:rounded-[58px] lg:bg-[#0c0b10] lg:p-3"
          style={{ boxShadow: "0 40px 120px -25px var(--c-glow), 0 30px 90px -30px rgba(0,0,0,0.6)" }}
        >
          <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-bg pt-[env(safe-area-inset-top)] lg:h-[812px] lg:max-h-[82vh] lg:rounded-[46px] lg:pt-0">
            {/* notch (mockup only) */}
            <div className="absolute left-1/2 top-2 z-40 hidden h-7 w-32 -translate-x-1/2 rounded-full bg-[#0c0b10] lg:block" />

            {!authReady ? (
              /* checking for an existing session */
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <span className="accent-grad glow grid h-14 w-14 place-items-center rounded-2xl text-2xl font-extrabold text-white">S</span>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-3/30 border-t-ink-3" />
              </div>
            ) : !user ? (
              /* hard gate — no account, no app */
              <Auth onAuthed={handleAuthed} initialMode="login" />
            ) : (
              <>
            {/* fake status bar only in the desktop mockup; real phones show their own */}
            <div className="hidden lg:block">
              <StatusBar />
            </div>

            {/* app body */}
            <div ref={bodyRef} onScroll={onBodyScroll} className="relative min-h-0 flex-1 overflow-y-auto bg-bg no-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="h-full"
                >
                  <ErrorBoundary resetKey={tab}>
                  {tab === "explore" && (
                    <Explore
                      onOpen={setOpenEvent}
                      isSaved={isSaved}
                      onToggleSave={toggleSave}
                      events={events}
                      loading={loading}
                      error={error}
                      center={center}
                      dateRange={dateRange}
                      setDateRange={setDateRange}
                      onSearchArea={searchArea}
                      onSearchPlace={searchPlace}
                      view={exploreView}
                      setView={goToView}
                      theme={theme}
                      onToggleTheme={toggleTheme}
                      tourEvents={tourEvents}
                      onShowArtist={showArtist}
                    />
                  )}
                  {tab === "saved" && (
                    <Saved
                      onOpen={setOpenEvent}
                      saved={savedMap}
                      isSaved={isSaved}
                      onToggleSave={toggleSave}
                    />
                  )}
                  {tab === "profile" && (
                    <Profile
                      theme={theme}
                      onToggleTheme={toggleTheme}
                      user={user}
                      onLogout={handleLogout}
                      onUserChange={handleUserChange}
                    />
                  )}
                  </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* floating Map button — pinned to the screen, not the scroll area */}
            {tab === "explore" && exploreView === "list" && !openEvent && (
              <button
                onClick={() => goToView("map")}
                className={`accent-grad glow absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center rounded-full font-bold text-white transition-all duration-300 active:scale-95 ${
                  condensed ? "bottom-[58px] h-11 w-11 gap-0" : "bottom-[92px] gap-2 px-5 py-3 text-[14px]"
                }`}
              >
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                    condensed ? "max-w-0 opacity-0" : "max-w-[60px] opacity-100"
                  }`}
                >
                  Map
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {/* detail sheet */}
            <AnimatePresence>
              {openEvent && (
                <EventDetail
                  event={openEvent}
                  onClose={() => setOpenEvent(null)}
                  saved={isSaved(openEvent.id)}
                  onToggleSave={toggleSave}
                />
              )}
            </AnimatePresence>

            {/* ---- bottom tab bar (hidden for the immersive map view) ---- */}
            {!(tab === "explore" && exploreView === "map") && (
            <div
              style={{ paddingBottom: `max(${condensed ? "0.5rem" : "1.25rem"}, env(safe-area-inset-bottom))` }}
              className={`glass absolute inset-x-0 bottom-0 z-10 border-t border-line-soft px-8 transition-all duration-300 ${
                condensed ? "pt-1" : "pt-2"
              }`}
            >
              <div className="flex items-center justify-between">
                {TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className="flex flex-1 flex-col items-center gap-1 py-1"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        className={`transition-all duration-300 ${active ? "text-ink" : "text-ink-3"} ${
                          condensed ? "h-[22px] w-[22px]" : "h-6 w-6"
                        }`}
                      >
                        {t.icon(active)}
                      </svg>
                      <span
                        className={`overflow-hidden text-[10px] transition-all duration-300 ${
                          active ? "font-bold text-ink" : "font-medium text-ink-3"
                        } ${condensed ? "max-h-0 opacity-0" : "max-h-4 opacity-100"}`}
                      >
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className={`mx-auto h-1 w-32 rounded-full bg-ink/25 transition-all duration-300 ${
                  condensed ? "mt-1" : "mt-1.5"
                }`}
              />
            </div>
            )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
