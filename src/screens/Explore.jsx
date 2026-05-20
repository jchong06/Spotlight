import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { EventCard } from "../components/EventCard.jsx";
import DatePanel from "../components/DatePanel.jsx";
import LocationSearch from "../components/LocationSearch.jsx";
import MapScreen from "./MapScreen.jsx";
import { categories, matchSub } from "../data.js";

export default function Explore({
  onOpen, isSaved, onToggleSave, events, loading, error, center, dateRange, setDateRange, onSearchArea,
  view, setView, theme, onToggleTheme, onSearchPlace, tourEvents, onShowArtist,
}) {
  const [cat, setCat] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showDates, setShowDates] = useState(false);
  const [showLoc, setShowLoc] = useState(false);

  const list = useMemo(() => events.filter((e) => matchSub(e, cat)), [cat, events]);

  // the map shows the artist tour when active, otherwise all EDM in the area
  const mapEvents = tourEvents && tourEvents.length ? tourEvents : events;
  const fitAll = !!(tourEvents && tourEvents.length);
  const selId = selected && mapEvents.some((e) => e.id === selected) ? selected : null;

  if (view === "map") {
    return (
      <MapScreen
        events={mapEvents}
        fitAll={fitAll}
        center={center}
        loading={loading}
        onOpen={onOpen}
        selected={selId}
        setSelected={setSelected}
        onSearchArea={onSearchArea}
        onSearchPlace={onSearchPlace}
        onShowArtist={onShowArtist}
        dateRange={dateRange}
        setDateRange={setDateRange}
        theme={theme}
        onList={() => setView("list")}
      />
    );
  }

  return (
    <div className="relative h-full">
      {/* sticky search header */}
      <div className="glass sticky top-0 z-20 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowLoc((v) => !v); setShowDates(false); }}
            className="card flex flex-1 items-center gap-3 rounded-full px-4 py-3"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="text-ink">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.4" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span className="min-w-0 text-left leading-tight">
              <span className="block truncate text-[14px] font-bold text-ink">{center.label}</span>
              <span className="block text-[12px] text-ink-3">
                {dateRange.label} · {loading ? "searching…" : `${events.length} events`}
              </span>
            </span>
          </button>
          <button
            onClick={onToggleTheme}
            aria-label="Toggle light/dark theme"
            className="card grid h-12 w-12 shrink-0 place-items-center rounded-full text-ink"
          >
            {theme === "dark" ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.9" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { setShowDates((v) => !v); setShowLoc(false); }}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${
              showDates ? "accent-grad border-transparent text-white" : "card text-ink"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
              <path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {showLoc && (
            <LocationSearch
              key="loc"
              center={center}
              onOpenEvent={onOpen}
              onShowArtist={onShowArtist}
              onPick={onSearchPlace}
              onClose={() => setShowLoc(false)}
              className="mt-3"
            />
          )}
          {showDates && (
            <DatePanel
              key="dates"
              dateRange={dateRange}
              setDateRange={setDateRange}
              onClose={() => setShowDates(false)}
              className="mt-3"
            />
          )}
        </AnimatePresence>

        {/* category row */}
        <div className="-mx-4 mt-3 flex gap-6 overflow-x-auto px-4 no-scrollbar">
          {categories.map((c) => {
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className="relative flex shrink-0 flex-col items-center gap-1.5 pb-2"
              >
                <span className={`text-xl ${active ? "text-ink" : "text-ink-3"}`}>{c.icon}</span>
                <span className={`text-[12px] ${active ? "font-bold text-ink" : "font-medium text-ink-3"}`}>
                  {c.label}
                </span>
                {active && (
                  <motion.span layoutId="cat-underline" className="accent-grad absolute -bottom-0 h-[3px] w-full rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        <div className="-mx-4 border-b border-line-soft" />
      </div>

      {/* listings */}
      <div className="px-4 pb-32 pt-4">
        <p className="mb-3 text-[13px] font-semibold text-ink-3">
          {loading ? "Finding events…" : `${list.length} events · ${dateRange.label}`}
        </p>

        {error ? (
          <div className="mt-16 px-6 text-center">
            <h3 className="text-[17px] font-bold text-ink">Couldn't load events</h3>
            <p className="mt-1 text-[14px] text-ink-3">{error}</p>
          </div>
        ) : loading ? (
          <div className="space-y-7">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[20/19] w-full rounded-2xl bg-bg-3" />
                <div className="mt-3 h-4 w-2/3 rounded bg-bg-3" />
                <div className="mt-2 h-3 w-1/2 rounded bg-bg-3" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="mt-16 px-6 text-center">
            <h3 className="text-[17px] font-bold text-ink">Nothing here {dateRange.label.toLowerCase()}</h3>
            <p className="mt-1 text-[14px] text-ink-3">
              Try another date, a different category, or pan the map to a new area.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            <AnimatePresence mode="popLayout">
              {list.map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  index={i}
                  onOpen={onOpen}
                  saved={isSaved(e.id)}
                  onToggleSave={onToggleSave}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
