import { motion } from "motion/react";
import { events, venues, CITY } from "../data.js";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 30 } },
};

function HeatBar({ value }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,var(--color-beam),var(--color-marquee))" }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
        />
      </div>
      <span className="font-mono text-[10px] text-cream-faint">{value}</span>
    </div>
  );
}

export default function Discover({ onOpen }) {
  const [hero, ...rest] = events;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="px-5 pb-28 pt-2">
      {/* masthead */}
      <motion.header variants={rise} className="mb-5 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-cream-dim">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-signal" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{CITY}</span>
          </div>
          <h1 className="mt-1 font-display text-[34px] font-extrabold leading-[0.92] tracking-tight text-cream">
            Find the
            <br />
            <span className="italic text-beam">night.</span>
          </h1>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-full border border-line bg-ink-2 text-cream">
          <span className="font-display text-lg font-bold">JL</span>
        </button>
      </motion.header>

      {/* search */}
      <motion.button
        variants={rise}
        className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-line bg-ink-2 px-4 py-3.5 text-left"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-cream-faint">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-cream-faint">Search 200+ venues, artists, nights…</span>
      </motion.button>

      {/* section label */}
      <motion.div variants={rise} className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-cream">
          Hot tonight
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-cream-faint">
          ranked by heat
        </span>
      </motion.div>

      {/* hero card */}
      <motion.button
        variants={rise}
        onClick={() => onOpen(hero)}
        whileTap={{ scale: 0.98 }}
        className="relative mb-4 block w-full overflow-hidden rounded-[26px] text-left"
        style={{ background: hero.hue }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="relative flex h-56 flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <span className="flex items-center gap-1.5 rounded-full bg-ink/55 px-2.5 py-1 backdrop-blur">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-marquee" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-cream">Live now</span>
            </span>
            <span className="rounded-full bg-ink/55 px-2.5 py-1 font-mono text-[10px] text-cream backdrop-blur">
              {hero.source}
            </span>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-cream/80">{hero.kind}</p>
            <h3 className="mt-0.5 font-display text-[30px] font-extrabold leading-none tracking-tight text-cream">
              {hero.title}
            </h3>
            <div className="mt-2 flex items-center gap-3 text-cream/90">
              <span className="text-sm">{hero.venue}</span>
              <span className="text-cream/40">·</span>
              <span className="text-sm">{hero.time}</span>
              <span className="text-cream/40">·</span>
              <span className="text-sm">{hero.distance}</span>
            </div>
          </div>
        </div>
      </motion.button>

      {/* list */}
      <div className="space-y-3">
        {rest.map((e) => (
          <motion.button
            key={e.id}
            variants={rise}
            onClick={() => onOpen(e)}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-ink-2 p-3 text-left"
          >
            <div className="h-16 w-16 shrink-0 rounded-xl" style={{ background: e.hue }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {e.live && <span className="live-dot h-1.5 w-1.5 rounded-full bg-marquee" />}
                <p className="font-mono text-[10px] uppercase tracking-widest text-cream-faint">{e.kind}</p>
              </div>
              <h4 className="truncate font-display text-lg font-bold leading-tight text-cream">{e.title}</h4>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-cream-dim">
                <span className="truncate">{e.venue}</span>
                <span className="text-cream-faint">·</span>
                <span className="shrink-0">{e.distance}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="font-display text-base font-bold text-beam">{e.price}</span>
              <HeatBar value={e.heat} />
            </div>
          </motion.button>
        ))}
      </div>

      {/* venue strip */}
      <motion.div variants={rise} className="mb-3 mt-7 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-cream">Venues</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-cream-faint">200+ in network</span>
      </motion.div>
      <motion.div variants={rise} className="-mx-5 flex gap-3 overflow-x-auto px-5 no-scrollbar">
        {venues.map((v) => (
          <div key={v.id} className="w-40 shrink-0 rounded-2xl border border-line bg-ink-2 p-3.5">
            <div className="flex items-center justify-between">
              <span
                className={`h-2 w-2 rounded-full ${v.open ? "bg-signal" : "bg-cream-faint"}`}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-cream-faint">
                {v.open ? "Open" : "Closed"}
              </span>
            </div>
            <h4 className="mt-3 font-display text-base font-bold leading-tight text-cream">{v.name}</h4>
            <p className="mt-0.5 text-xs text-cream-dim">{v.type}</p>
            <p className="mt-2 font-mono text-[10px] text-cream-faint">cap {v.cap}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
