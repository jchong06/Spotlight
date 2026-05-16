import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { geocodePlace, fetchArtistEvents, searchVenues, fetchVenueEvents, isPopularArtist } from "../api.js";

// Unified search bar: live artist/event search across a wide date window AND
// the whole map (not limited to the selected date or area), plus place
// geocoding. Results are grouped by artist; picking an artist plots their whole
// tour on the map. `className` positions it.
export default function LocationSearch({ center, onOpenEvent, onShowArtist, onPick, onClose, className = "" }) {
  const [q, setQ] = useState("");
  const [eventResults, setEventResults] = useState([]);
  const [venues, setVenues] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // debounced: artists/events + venues + place geocoding (all date-independent)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) { setEventResults([]); setVenues([]); setPlaces([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const [ev, vn, pl] = await Promise.all([
        fetchArtistEvents({ lat: center?.lat ?? 0, lng: center?.lng ?? 0, query }),
        searchVenues(query),
        query.length >= 3 ? geocodePlace(query) : Promise.resolve([]),
      ]);
      setEventResults(ev);
      setVenues(vn);
      setPlaces(pl);
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q, center]);

  const pickEvent = (e) => { onOpenEvent?.(e); onClose(); };
  const pickPlace = (p) => { onPick?.(p); onClose(); };
  const showAll = () => { onShowArtist?.(eventResults); onClose(); };
  const pickVenue = async (v) => {
    setLoading(true);
    const evs = await fetchVenueEvents({ venueId: v.id, center });
    setLoading(false);
    if (evs.length) onShowArtist?.(evs); // plot the venue's upcoming shows on the map
    else if (Number.isFinite(v.lat)) onPick?.({ lat: v.lat, lng: v.lng, label: v.name }); // no upcoming — just go there
    onClose();
  };

  // Ranking: a known popular EDM artist wins; else a clearly-popular location
  // (major city) wins; otherwise venues lead (you're probably searching one).
  const artistFirst = isPopularArtist(q) && eventResults.length > 0;
  const placeFirst = !artistFirst && places[0]?.major;
  const priority = artistFirst ? "events" : placeFirst ? "places" : "venues";
  const order = (s) => (s === priority ? "order-1" : s === "venues" ? "order-2" : s === "places" ? (priority === "venues" ? "order-2" : "order-3") : "order-3");

  // Enter with no selection: respect the same priority
  const submit = (e) => {
    e.preventDefault();
    if (priority === "events" && eventResults.length) showAll();
    else if (priority === "places" && places[0]) pickPlace(places[0]);
    else if (venues[0]) pickVenue(venues[0]);
    else if (places[0]) pickPlace(places[0]);
    else if (eventResults.length) showAll();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border border-line bg-bg p-3 shadow-[0_8px_28px_rgba(0,0,0,0.16)] ${className}`}
    >
      <form onSubmit={submit} className="flex items-center gap-2 rounded-xl bg-bg-2 px-3.5 py-2.5">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search artists, venues, or a place"
          className="w-full bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-ink-3"
        />
        {loading && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ink-3/40 border-t-ink-3" />}
      </form>

      <div className="mt-2 flex max-h-[260px] flex-col overflow-y-auto no-scrollbar">
        {venues.length > 0 && (
          <div className={order("venues")}>
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">Venues</p>
            <div className="mb-2 overflow-hidden rounded-xl border border-line-soft">
              {venues.map((v) => (
                <button
                  key={v.id}
                  onClick={() => pickVenue(v)}
                  className="flex w-full items-center gap-3 border-b border-line-soft px-3.5 py-2.5 text-left transition-colors last:border-b-0 active:bg-bg-2"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
                    <path d="M3 21V8l9-5 9 5v13M3 21h18M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{v.name}</span>
                    {v.city && <span className="block truncate text-[12px] text-ink-3">{v.city}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-ink-3">Upcoming ›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {places.length > 0 && (
          <div className={order("places")}>
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">Places</p>
            <div className="mb-2 overflow-hidden rounded-xl border border-line-soft">
              {places.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickPlace(r)}
                  className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors active:bg-bg-2 ${
                    i < places.length - 1 ? "border-b border-line-soft" : ""
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-ink-3">
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
          </div>
        )}

        {eventResults.length > 0 && (
          <div className={order("events")}>
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Events</p>
              {eventResults.length > 1 && (
                <button onClick={showAll} className="flex items-center gap-1 text-[11px] font-bold text-ink">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Show all on map
                </button>
              )}
            </div>
            <div className="mb-2 overflow-hidden rounded-xl border border-line-soft">
              {eventResults.map((e) => (
                <button
                  key={e.id}
                  onClick={() => pickEvent(e)}
                  className="flex w-full items-center gap-3 border-b border-line-soft px-3 py-2.5 text-left transition-colors last:border-b-0 active:bg-bg-2"
                >
                  <span
                    className="h-9 w-9 shrink-0 rounded-lg bg-bg-3 bg-cover bg-center"
                    style={e.img ? { backgroundImage: `url('${e.img}')` } : undefined}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink">{e.host}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {e.venue} · {e.date}{e.distance ? ` · ${e.distance}` : ""}
                    </span>
                  </span>
                  {e.genre && <span className="shrink-0 text-[11px] font-medium text-ink-3">{e.genre}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && q.trim().length >= 2 && eventResults.length === 0 && venues.length === 0 && places.length === 0 && (
          <p className="order-4 px-1 py-1 text-[13px] text-ink-3">No matches for “{q.trim()}”.</p>
        )}
      </div>
    </motion.div>
  );
}
