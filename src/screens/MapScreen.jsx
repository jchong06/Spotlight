import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AnimatePresence } from "motion/react";
import { MiniCard } from "../components/EventCard.jsx";
import DatePanel from "../components/DatePanel.jsx";
import LocationSearch from "../components/LocationSearch.jsx";
import { milesBetween } from "../api.js";

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

export default function MapScreen({
  events, fitAll, center, loading, onOpen, selected, setSelected, onSearchArea, onSearchPlace, onShowArtist, dateRange, setDateRange, theme, onList,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const markers = useRef({});
  const cardRow = useRef(null);
  const selectedRef = useRef(selected); // current selection, readable inside marker handlers
  const programmatic = useRef(false); // true while we recenter the map ourselves
  const [showSearch, setShowSearch] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [showLoc, setShowLoc] = useState(false);
  const panelOpen = showDates || showLoc;

  // init map once
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    const map = L.map(mapEl.current, {
      center: [center.lat, center.lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    tileRef.current = L.tileLayer(TILES[theme] || TILES.light, {
      attribution: "© OpenStreetMap · © CARTO",
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    map.on("moveend", () => {
      if (programmatic.current) { programmatic.current = false; return; }
      setShowSearch(true);
    });

    setTimeout(() => map.invalidateSize(), 60);
    setTimeout(() => map.invalidateSize(), 400);
  }, [center.lat, center.lng]);

  // recenter the map when the search center changes (e.g. a location search)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - center.lat) < 1e-6 && Math.abs(c.lng - center.lng) < 1e-6) return;
    programmatic.current = true;
    setShowSearch(false);
    map.flyTo([center.lat, center.lng], 13, { duration: 0.6 });
  }, [center.lat, center.lng]);

  // overlay mode (artist tour / venue): a single venue or tight cluster zooms
  // right in; a multi-city spread frames the continental US (no AK/HI), with
  // overseas pins still loaded (pan to reach).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitAll) return;
    const pts = events.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng)).map((e) => [e.lat, e.lng]);
    if (!pts.length) return;
    const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1]);
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    const bounds = L.latLngBounds(pts);
    programmatic.current = true;
    setShowSearch(false);
    if (span < 0.6) {
      // one venue / one city — zoom in to it
      map.flyTo(bounds.getCenter(), 13, { duration: 0.7 });
    } else if (pts.some(([la, ln]) => la >= 24 && la <= 50 && ln >= -125 && ln <= -66)) {
      // multi-city US tour — frame the lower 48
      map.flyToBounds(L.latLngBounds([24.4, -124.8], [49.4, -66.9]), { padding: [16, 16], maxZoom: 6, duration: 0.7 });
    } else {
      const z = Math.min(11, Math.max(4, map.getBoundsZoom(bounds, false, L.point(40, 60))));
      map.flyTo(bounds.getCenter(), z, { duration: 0.7 });
    }
  }, [events, fitAll]);

  // swap basemap when the theme changes (dark map for dark mode)
  useEffect(() => {
    if (tileRef.current) tileRef.current.setUrl(TILES[theme] || TILES.light);
  }, [theme]);

  // (re)build markers whenever the event set changes
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markers.current = {};

    // Events at the exact same spot — e.g. every upcoming show at one venue —
    // would otherwise stack into a pile of overlapping pins (a blur of halos
    // behind the front one). Group by location and plot ONE pin per spot, with
    // a count badge; the bottom carousel still lets you browse each show.
    const groups = new Map();
    events.forEach((ev) => {
      if (!Number.isFinite(ev.lat) || !Number.isFinite(ev.lng)) return;
      const key = `${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`;
      (groups.get(key) || groups.set(key, []).get(key)).push(ev);
    });

    const iconFor = (ev, count) => {
      const style = ev.img ? ` style="background-image:url('${ev.img}')"` : "";
      const empty = ev.img ? "" : " photo-pin--empty";
      const badge = count > 1 ? `<span class="pin-count">${count}</span>` : "";
      return L.divIcon({
        className: "pin-wrap",
        html: `<div class="photo-pin${empty}${ev.live ? " live" : ""}" data-id="${ev.id}"${style}>${badge}</div>`,
        iconSize: null,
        iconAnchor: [22, 22],
      });
    };

    groups.forEach((group, key) => {
      const rep = group[0];
      const ids = group.map((e) => e.id);
      const m = L.marker([rep.lat, rep.lng], { icon: iconFor(rep, group.length) }).addTo(layer);
      // first tap → select; tapping again when its event is selected → details.
      // for a multi-show pin, the carousel drives which show is selected.
      m.on("click", () => {
        const sel = selectedRef.current;
        if (ids.includes(sel)) onOpen(group.find((e) => e.id === sel));
        else setSelected(ids[0]);
      });
      markers.current[key] = { marker: m, group, ids, count: group.length, shownId: rep.id, iconFor };
    });
    setShowSearch(false);
  }, [events, setSelected, onOpen]);

  // reflect selection: highlight pin, pan, scroll card into view
  useEffect(() => {
    selectedRef.current = selected;
    Object.values(markers.current).forEach((g) => {
      const inGroup = g.ids.includes(selected);
      // a multi-show venue pin surfaces whichever show is currently selected
      if (g.count > 1) {
        const showId = inGroup ? selected : g.ids[0];
        if (showId !== g.shownId) {
          g.marker.setIcon(g.iconFor(g.group.find((e) => e.id === showId), g.count));
          g.shownId = showId;
        }
      }
      g.marker.getElement()?.querySelector(".photo-pin")?.classList.toggle("active", inGroup);
    });
    if (!selected || !mapRef.current) return;
    const ev = events.find((e) => e.id === selected);
    if (ev) mapRef.current.panTo([ev.lat, ev.lng], { animate: true, duration: 0.4 });
    const card = cardRow.current?.querySelector(`[data-card="${selected}"]`);
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected, events]);

  const handleSearchArea = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const ne = map.getBounds().getNorthEast();
    const radiusMiles = milesBetween(c.lat, c.lng, ne.lat, ne.lng);
    setShowSearch(false);
    onSearchArea({ lat: c.lat, lng: c.lng, radiusMiles });
  };

  return (
    <div className="absolute inset-0">
      <div ref={mapEl} className="absolute inset-0" />

      {/* top bar — search a place, or change the date, without leaving the map */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-4 pt-3">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[92%] items-center gap-2">
          <button
            onClick={() => { setShowLoc((v) => !v); setShowDates(false); }}
            className="glass glow flex flex-1 items-center gap-3 rounded-full px-5 py-3 text-left"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.4" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-bold text-ink">{center.label}</div>
              <div className="text-[11px] text-ink-3">
                {dateRange.label} · {loading ? "searching…" : `${events.length} events`}
              </div>
            </div>
          </button>
          <button
            onClick={() => { setShowDates((v) => !v); setShowLoc(false); }}
            className={`glass grid h-12 w-12 shrink-0 place-items-center rounded-full ${showDates ? "accent-grad text-white" : "text-ink"}`}
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
              className="pointer-events-auto mx-auto mt-2 max-w-[92%]"
            />
          )}
          {showDates && (
            <DatePanel
              key="dates"
              dateRange={dateRange}
              setDateRange={setDateRange}
              onClose={() => setShowDates(false)}
              className="pointer-events-auto mx-auto mt-2 max-w-[92%]"
            />
          )}
        </AnimatePresence>
      </div>

      {/* "search this area" — appears after you pan/zoom */}
      {showSearch && !loading && !panelOpen && (
        <button
          onClick={handleSearchArea}
          className="accent-grad glow absolute left-1/2 top-[68px] z-[600] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-white active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Search this area
        </button>
      )}

      {loading && !panelOpen && (
        <div className="glass absolute left-1/2 top-[68px] z-[600] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-ink shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-rausch/30 border-t-rausch" />
          Updating…
        </div>
      )}

      {/* bottom card carousel */}
      {events.length > 0 && !panelOpen && (
        <div
          ref={cardRow}
          className="absolute inset-x-0 bottom-[24px] z-[500] flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {events.map((ev) => (
            <div
              key={ev.id}
              data-card={ev.id}
              style={{ scrollSnapAlign: "center" }}
              onClick={() => setSelected(ev.id)}
              className={`rounded-2xl transition-transform ${
                selected === ev.id ? "scale-100" : "scale-[0.97] opacity-90"
              }`}
            >
              <MiniCard event={ev} onOpen={onOpen} />
            </div>
          ))}
        </div>
      )}

      {/* list toggle */}
      {!panelOpen && (
        <button
          onClick={onList}
          className="accent-grad glow absolute bottom-[148px] left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold text-white active:scale-95"
        >
          List
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
