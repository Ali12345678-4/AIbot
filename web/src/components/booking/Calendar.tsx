"use client";
import { useMemo, useRef } from "react";
import { Icon } from "../Icon";
import { addDaysYmd, weekdayOf, ymd } from "@/lib/availability";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = ymd(y, m, 1);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first, last: ymd(y, m, days), days, y, m };
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function Calendar({
  month,
  onMonthChange,
  available,
  loading,
  selected,
  onSelect,
  minMonth,
  maxMonth,
  today,
}: {
  month: string;
  onMonthChange: (m: string) => void;
  available: Set<string>;
  loading: boolean;
  selected: string | null;
  onSelect: (d: string) => void;
  minMonth: string;
  maxMonth: string;
  today: string;
}) {
  const { first, days, y, m } = monthBounds(month);
  const lead = (weekdayOf(first) + 6) % 7; // Monday-first grid
  const cells = useMemo(() => {
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(ymd(y, m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [lead, days, y, m]);
  const gridRef = useRef<HTMLDivElement>(null);

  const focusDate = (d: string) => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${d}"]`);
    el?.focus();
  };

  const onKey = (e: React.KeyboardEvent, d: string) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = addDaysYmd(d, delta);
    if (next.slice(0, 7) !== month) {
      const nm = next.slice(0, 7);
      if (nm < minMonth || nm > maxMonth) return;
      onMonthChange(nm);
      setTimeout(() => focusDate(next), 50);
    } else focusDate(next);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.015em]" aria-live="polite">
          {MONTHS[m - 1]} {y}
        </h3>
        <div className="flex gap-1">
          <button type="button" className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-mist disabled:opacity-30" onClick={() => onMonthChange(shiftMonth(month, -1))} disabled={month <= minMonth} aria-label="Previous month">
            <Icon name="alt-arrow-left-linear" size={20} />
          </button>
          <button type="button" className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-mist disabled:opacity-30" onClick={() => onMonthChange(shiftMonth(month, 1))} disabled={month >= maxMonth} aria-label="Next month">
            <Icon name="alt-arrow-right-linear" size={20} />
          </button>
        </div>
      </div>
      <div role="grid" aria-label="Choose a date" ref={gridRef} aria-busy={loading}>
        <div role="row" className="grid grid-cols-7 pb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} role="columnheader" className="text-center text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">
              <abbr title={w} className="no-underline">{w}</abbr>
            </div>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <div role="row" key={r} className="grid grid-cols-7 gap-1">
            {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (!d) return <div role="gridcell" key={i} />;
              const isAvail = available.has(d);
              const isSel = selected === d;
              const isToday = d === today;
              const day = Number(d.slice(8));
              return (
                <div role="gridcell" key={d} className="flex justify-center py-0.5">
                  <button
                    type="button"
                    data-date={d}
                    disabled={!isAvail || loading}
                    aria-pressed={isSel}
                    aria-label={`${day} ${MONTHS[m - 1]}${isAvail ? ", available" : ", unavailable"}`}
                    tabIndex={isSel || (!selected && isAvail && d === [...available].sort()[0]) ? 0 : -1}
                    onKeyDown={(e) => onKey(e, d)}
                    onClick={() => onSelect(d)}
                    className={`relative grid aspect-square w-full max-w-[52px] place-items-center rounded-full text-[15px] font-medium tabular-nums transition-all duration-200
                      ${isSel ? "bg-accent text-white shadow-[0_6px_18px_-8px_rgba(14,94,71,.8)]" : isAvail ? "bg-accent-soft text-accent-ink hover:bg-[#d6e9e1]" : "text-faint/70"}
                      ${loading ? "animate-pulse" : ""}`}
                  >
                    {day}
                    {isToday && <span className={`absolute bottom-1.5 size-1 rounded-full ${isSel ? "bg-white" : "bg-current"}`} aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
