import { useState } from "react";
import { motion } from "motion/react";

export default function EventDetail({ event, onClose, saved, onToggleSave }) {
  const [imgOk, setImgOk] = useState(true);
  const [showBuy, setShowBuy] = useState(false);

  const buyOptions = [
    event.tmUrl && { label: "Ticketmaster", url: event.tmUrl },
    event.sgUrl && { label: "SeatGeek", url: event.sgUrl },
    event.bitUrl && { label: "Bandsintown", url: event.bitUrl },
  ].filter(Boolean);
  if (!buyOptions.length && event.url) buyOptions.push({ label: "Get tickets", url: event.url });
  return (
    <>
      <motion.div
        className="absolute inset-0 z-[1000] bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-[1001] max-h-[90%] overflow-y-auto rounded-t-[28px] bg-bg no-scrollbar"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        {/* hero image */}
        <div className="relative h-60 bg-bg-3">
          {imgOk ? (
            <img
              src={event.img}
              alt={event.title}
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-bg-3 to-bg-2" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/45 to-transparent" />
          <button
            onClick={onClose}
            className="glass absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink shadow active:scale-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-ink">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => onToggleSave?.(event)}
            className="glass absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full shadow active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={saved ? "#ff4d6d" : "none"}
                stroke={saved ? "#ff4d6d" : "currentColor"}
                strokeWidth="2"
                className="text-ink"
              />
            </svg>
          </button>
          {event.live && (
            <span className="accent-grad absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
              Happening now
            </span>
          )}
        </div>

        <div className="px-5 pb-10 pt-5">
          <h2 className="font-display text-2xl font-bold leading-tight text-ink">{event.host || event.title}</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            {event.venue}{event.distance && ` · ${event.distance} away`}
          </p>
          {event.genre && (
            <div className="mt-2 inline-flex items-center rounded-full bg-bg-2 px-3 py-1 text-[13px] font-semibold text-ink-2">
              {event.genre}
            </div>
          )}

          <div className="my-5 h-px bg-line-soft" />

          {/* host row */}
          <div className="flex items-center gap-3">
            <div className="accent-grad grid h-11 w-11 place-items-center rounded-full text-white">
              <span className="text-sm font-bold">{event.host.slice(0, 1)}</span>
            </div>
            <div>
              <div className="text-[15px] font-bold text-ink">Presented by {event.host}</div>
              <div className="text-[13px] text-ink-3">via {event.source}</div>
            </div>
          </div>

          <div className="my-5 h-px bg-line-soft" />

          <p className="text-[15px] leading-relaxed text-ink-2">{event.blurb}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {event.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-line bg-bg-2 px-3 py-1.5 text-[12px] font-medium text-ink-2"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-bg-2 p-4 text-[14px] text-ink-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink">
              <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            {event.venue} · {event.date} at {event.time}
          </div>
        </div>

        {/* sticky CTA — one card, but buy from whichever source(s) list it */}
        <div className="glass sticky bottom-0 border-t border-line px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-ink-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
              <path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {event.date} · {event.time}
          </div>
          {!showBuy ? (
            <button
              onClick={() => setShowBuy(true)}
              className="buy-primary w-full rounded-2xl py-3.5 text-[15px] font-bold active:scale-95"
            >
              Purchase tickets
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="mb-2 text-[12px] font-semibold text-ink-3">
                {buyOptions.length > 1 ? "Buy from" : "Continue to"}
              </p>
              <div className="flex flex-wrap gap-2">
                {buyOptions.map((s, i) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`min-w-[30%] flex-1 rounded-2xl py-3.5 text-center text-[15px] font-bold active:scale-95 ${
                      i === 0 ? "buy-primary" : "buy-secondary bg-bg"
                    }`}
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
}
