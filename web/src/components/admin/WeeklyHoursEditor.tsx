"use client";
import { useState } from "react";
import { Icon } from "../Icon";

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Range = { start: string; end: string };

export function WeeklyHoursEditor({ initial }: { initial: { weekday: number; start_time: string; end_time: string }[] }) {
  const [state, setState] = useState(() => {
    const m: Record<number, { on: boolean; ranges: Range[] }> = {};
    for (const d of DAYS) {
      const r = initial.filter((x) => x.weekday === d).map((x) => ({ start: x.start_time.slice(0, 5), end: x.end_time.slice(0, 5) })).sort((a, b) => a.start.localeCompare(b.start));
      m[d] = { on: r.length > 0, ranges: r.length ? r : [{ start: "09:00", end: "17:00" }] };
    }
    return m;
  });
  const update = (d: number, fn: (v: { on: boolean; ranges: Range[] }) => { on: boolean; ranges: Range[] }) => setState((s) => ({ ...s, [d]: fn(s[d]) }));

  return (
    <ul className="divide-y divide-line">
      {DAYS.map((d) => {
        const v = state[d];
        return (
          <li key={d} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
            <label className="flex w-40 items-center gap-3 pt-2.5 font-medium">
              <input type="checkbox" name={`on_${d}`} checked={v.on} onChange={(e) => update(d, (x) => ({ ...x, on: e.target.checked }))} className="size-5 accent-[var(--color-accent)]" />
              {NAMES[d]}
            </label>
            {v.on ? (
              <div className="flex-1 space-y-2">
                {v.ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" step={300} name={`start_${d}`} value={r.start} aria-label={`${NAMES[d]} start ${i + 1}`} onChange={(e) => update(d, (x) => ({ ...x, ranges: x.ranges.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)) }))} className="field !min-h-[42px] w-[130px] !py-2" />
                    <span className="text-muted">to</span>
                    <input type="time" step={300} name={`end_${d}`} value={r.end} aria-label={`${NAMES[d]} end ${i + 1}`} onChange={(e) => update(d, (x) => ({ ...x, ranges: x.ranges.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)) }))} className="field !min-h-[42px] w-[130px] !py-2" />
                    {v.ranges.length > 1 && (
                      <button type="button" className="grid size-9 place-items-center rounded-full text-muted hover:bg-mist" aria-label="Remove time range" onClick={() => update(d, (x) => ({ ...x, ranges: x.ranges.filter((_, j) => j !== i) }))}>
                        <Icon name="trash-bin-trash-linear" size={18} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="text-[13px] font-semibold text-accent hover:underline" onClick={() => update(d, (x) => ({ ...x, ranges: [...x.ranges, { start: "18:00", end: "20:00" }] }))}>+ Add hours</button>
              </div>
            ) : (
              <p className="flex-1 pt-2.5 text-muted">Unavailable</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
