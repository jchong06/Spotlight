import { forwardRef, useState } from "react";
import { motion } from "motion/react";

function Heart({ active, onClick }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="absolute right-3 top-3 grid h-8 w-8 place-items-center active:scale-90"
      aria-label="Save"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={active ? "#ff4d6d" : "rgba(0,0,0,0.4)"}
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

// Full listing card
export const EventCard = forwardRef(function EventCard({ event, onOpen, saved, onToggleSave, index = 0 }, ref) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2, ease: "easeOut" } }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 280, damping: 28 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onOpen(event)}
      role="button"
      tabIndex={0}
      className="block w-full cursor-pointer text-left"
    >
      <div className="relative aspect-[20/19] w-full overflow-hidden rounded-[22px] bg-bg-3 accent-ring">
        {imgOk ? (
          <img
            src={event.img}
            alt={event.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="accent-grad h-full w-full opacity-80" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
        <Heart active={saved} onClick={() => onToggleSave?.(event)} />
        {event.live && (
          <span className="accent-grad absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
            Happening now
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display truncate text-[15px] font-bold leading-tight text-ink">{event.host || event.title}</h3>
          {event.genre && (
            <span className="shrink-0 rounded-full bg-bg-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">{event.genre}</span>
          )}
        </div>
        <p className="truncate text-[15px] text-ink-3">{event.venue}</p>
        <p className="text-[15px] text-ink-3">
          {event.date} · {event.time}{event.distance ? ` · ${event.distance}` : ""}
        </p>
      </div>
    </motion.div>
  );
});

// Compact card used in the map's bottom carousel
export function MiniCard({ event, onOpen }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      onClick={() => onOpen(event)}
      className="card glow flex w-[290px] shrink-0 items-stretch gap-3 rounded-3xl p-2.5 text-left"
    >
      <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-bg-3">
        {imgOk ? (
          <img
            src={event.img}
            alt=""
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="accent-grad h-full w-full opacity-80" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center pr-1">
        <p className="flex items-center gap-1 truncate text-[12px] font-bold text-rausch">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {event.date} · {event.time}
        </p>
        <h4 className="truncate text-[14px] font-bold leading-tight text-ink">{event.host || event.title}</h4>
        <p className="truncate text-[13px] text-ink-3">{event.venue}</p>
        {event.distance && <p className="mt-0.5 text-[13px] text-ink-3">{event.distance}</p>}
      </div>
    </button>
  );
}
