/**
 * Pure availability engine. No I/O, so it is unit-tested and shared by the
 * public booking API (to list slots) and the booking service (to re-validate
 * a requested slot server-side before inserting).
 */
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";

export interface Interval { start: number; end: number } // epoch ms, half-open [start, end)

export interface AvailabilityInput {
  timezone: string;
  weekly: { weekday: number; start_time: string; end_time: string }[];
  exceptions: { kind: "block" | "open"; starts_at: Date; ends_at: Date }[];
  /** Active bookings as [starts_at, blocked_until). */
  busy: Interval[];
  durationMinutes: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  now: Date;
}

const MIN = 60_000;

/** Local wall-clock date "YYYY-MM-DD" + "HH:MM[:SS]" in tz -> epoch ms. */
export function zonedToEpoch(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  return new TZDate(y, m - 1, d, hh, mm, ss || 0, tz).getTime();
}

export function todayInTz(tz: string, now = new Date()): string {
  const t = new TZDate(now.getTime(), tz);
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDaysYmd(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = addDays(new Date(Date.UTC(y, m - 1, d)), n);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function merge(list: Interval[]): Interval[] {
  const s = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

function subtract(base: Interval[], cut: Interval[]): Interval[] {
  let result = merge(base);
  for (const c of merge(cut)) {
    const next: Interval[] = [];
    for (const r of result) {
      if (c.end <= r.start || c.start >= r.end) { next.push(r); continue; }
      if (c.start > r.start) next.push({ start: r.start, end: c.start });
      if (c.end < r.end) next.push({ start: c.end, end: r.end });
    }
    result = next;
  }
  return result;
}

/** Working windows for one local date (weekly hours + extra openings - blocks). */
export function workingWindows(date: string, input: Pick<AvailabilityInput, "timezone" | "weekly" | "exceptions">): Interval[] {
  const tz = input.timezone;
  const dayStart = zonedToEpoch(date, "00:00", tz);
  const dayEnd = zonedToEpoch(addDaysYmd(date, 1), "00:00", tz);
  const wd = weekdayOf(date);
  const base: Interval[] = input.weekly
    .filter((w) => w.weekday === wd)
    .map((w) => ({ start: zonedToEpoch(date, w.start_time, tz), end: zonedToEpoch(date, w.end_time, tz) }));
  const clip = (i: Interval) => ({ start: Math.max(i.start, dayStart), end: Math.min(i.end, dayEnd) });
  const opens = input.exceptions.filter((e) => e.kind === "open").map((e) => clip({ start: +e.starts_at, end: +e.ends_at }));
  const blocks = input.exceptions.filter((e) => e.kind === "block").map((e) => ({ start: +e.starts_at, end: +e.ends_at }));
  return subtract([...base, ...opens], blocks);
}

/** Bookable start times (epoch ms) for a local date. */
export function slotsForDate(date: string, input: AvailabilityInput): number[] {
  const today = todayInTz(input.timezone, input.now);
  const lastDay = addDaysYmd(today, input.maxAdvanceDays);
  if (date < today || date > lastDay) return [];

  const earliest = input.now.getTime() + input.minNoticeHours * 60 * MIN;
  const dur = input.durationMinutes * MIN;
  const buf = input.bufferMinutes * MIN;
  const step = Math.max(5, input.slotIntervalMinutes) * MIN;
  const busy = merge(input.busy);

  const slots: number[] = [];
  for (const w of workingWindows(date, input)) {
    for (let s = w.start; s + dur <= w.end; s += step) {
      if (s < earliest) continue;
      // Candidate occupies [s, s + dur + buffer); must not overlap any active booking.
      const cEnd = s + dur + buf;
      if (busy.some((b) => s < b.end && cEnd > b.start)) continue;
      slots.push(s);
    }
  }
  return slots;
}

/** For a month view: which local dates in [from, to] have at least one slot. */
export function availableDates(from: string, to: string, input: AvailabilityInput): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) {
    if (slotsForDate(d, input).length) out.push(d);
  }
  return out;
}
