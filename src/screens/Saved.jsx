import { AnimatePresence } from "motion/react";
import { EventCard } from "../components/EventCard.jsx";

export default function Saved({ onOpen, saved, onToggleSave }) {
  const list = Object.values(saved || {});

  return (
    <div className="px-4 pb-28 pt-4">
      <h1 className="font-display mb-1 text-[30px] font-bold tracking-tight text-ink">Favorites</h1>
      <p className="mb-5 text-[14px] text-ink-3">Events you've hearted</p>

      {list.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-bg-2">
            <svg width="30" height="30" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ff4d6d" />
            </svg>
          </div>
          <h3 className="mt-4 text-[17px] font-bold text-ink">No favorites yet</h3>
          <p className="mt-1 max-w-[15rem] text-[14px] text-ink-3">
            Tap the heart on any event to add it to your favorites.
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
                saved
                onToggleSave={onToggleSave}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
