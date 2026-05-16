import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DATE_PRESETS, rangeForDates } from "../data.js";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-indexed
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const fmtShort = (str) => new Date(`${str}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Calendar({ dateRange, setDateRange, onClose }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const init = dateRange.date ? new Date(`${dateRange.date}T00:00:00`) : today;
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const [sel, setSel] = useState({
    start: dateRange.id === "custom" ? dateRange.date : null,
    end: dateRange.id === "custom" ? dateRange.endDate || dateRange.date : null,
  });

  const first = new Date(view.y, view.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const atCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();

  const shift = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  // tap 1 sets the start, tap 2 sets the end; tapping before the start restarts
  const pick = (str) =>
    setSel((s) => {
      if (!s.start || s.end) return { start: str, end: null };
      if (str < s.start) return { start: str, end: null };
      return { start: s.start, end: str };
    });

  const apply = () => {
    if (!sel.start) return;
    setDateRange(rangeForDates(sel.start, sel.end));
    onClose();
  };

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="mt-3 rounded-xl bg-bg-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          disabled={atCurrentMonth}
          className="grid h-7 w-7 place-items-center rounded-full text-ink disabled:opacity-25"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[13px] font-bold text-ink">
          {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-full text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEK.map((w, i) => (
          <span key={i} className="text-center text-[11px] font-semibold text-ink-3">{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />;
          const cellDate = new Date(view.y, view.m, d);
          const str = ymd(view.y, view.m, d);
          const disabled = cellDate < today;
          const isEnd = str === sel.start || str === sel.end;
          const inRange = sel.start && sel.end && str > sel.start && str < sel.end;
          const isToday = cellDate.getTime() === today.getTime();
          return (
            <div key={i} className={`flex justify-center ${inRange ? "bg-bg-3" : ""} ${str === sel.start && sel.end ? "rounded-l-full bg-bg-3" : ""} ${str === sel.end ? "rounded-r-full bg-bg-3" : ""}`}>
              <button
                disabled={disabled}
                onClick={() => pick(str)}
                className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-semibold transition ${
                  isEnd ? "accent-grad text-white" : inRange ? "text-ink" : isToday ? "text-rausch" : "text-ink-2"
                } ${disabled ? "opacity-25" : !isEnd ? "hover:bg-line-soft" : ""}`}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-2">
          {sel.start ? (sel.end ? `${fmtShort(sel.start)} – ${fmtShort(sel.end)}` : `${fmtShort(sel.start)} · pick end`) : "Select dates"}
        </span>
        <button
          onClick={apply}
          disabled={!sel.start}
          className="accent-grad rounded-full px-4 py-2 text-[13px] font-bold text-white transition disabled:opacity-30"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// Date selector used in both the list header and the map. `className` lets the
// caller position it (inline in the list, floating dropdown on the map).
export default function DatePanel({ dateRange, setDateRange, onClose, className = "" }) {
  const [pickOpen, setPickOpen] = useState(dateRange.id === "custom");
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border border-line bg-bg p-3 shadow-[0_8px_28px_rgba(0,0,0,0.16)] ${className}`}
    >
      <p className="mb-2 px-1 text-[12px] font-semibold text-ink-3">When</p>
      <div className="grid grid-cols-4 gap-1.5">
        {DATE_PRESETS.map((p) => {
          const active = dateRange.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setDateRange({ id: p.id, label: p.label, ...p.make() }); onClose(); }}
              className={`whitespace-nowrap rounded-full px-1 py-2 text-center text-[12px] font-semibold transition ${
                active ? "accent-grad text-white" : "border border-line bg-bg text-ink-2"
              }`}
            >
              {p.short || p.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setPickOpen((v) => !v)}
        className={`mt-3 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition ${
          dateRange.id === "custom" ? "accent-grad text-white" : "bg-bg-2 text-ink-2"
        }`}
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {dateRange.id === "custom" ? dateRange.label : "Pick a date"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`transition-transform ${pickOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {pickOpen && <Calendar dateRange={dateRange} setDateRange={setDateRange} onClose={onClose} />}
      </AnimatePresence>
    </motion.div>
  );
}
