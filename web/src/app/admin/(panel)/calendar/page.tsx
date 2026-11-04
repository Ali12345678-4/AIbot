import Link from "next/link";
import { query } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageHeader, Flash } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { addExceptionAction, deleteExceptionAction } from "@/app/admin/actions";
import { fmtTz } from "@/lib/format";
import { addDaysYmd, todayInTz, weekdayOf, workingWindows, zonedToEpoch } from "@/lib/availability";
import type { BookingStatus } from "@/lib/types";

export const metadata = { title: "Calendar" };

type View = "month" | "week" | "day";
interface B { id: string; starts_at: Date; ends_at: Date; status: BookingStatus; lesson_name: string; full_name: string }
interface X { id: string; kind: "block" | "open"; starts_at: Date; ends_at: Date; note: string | null }

const STATUS_BLOCK: Record<string, string> = {
  pending: "bg-warn-soft text-warn ring-1 ring-warn/30",
  confirmed: "bg-accent text-white",
  completed: "bg-accent-soft text-accent-ink",
  no_show: "bg-mist text-muted",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const tz = s.timezone;
  const today = todayInTz(tz);
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  let start: string, end: string; // inclusive local dates
  if (view === "month") {
    const first = `${date.slice(0, 7)}-01`;
    start = addDaysYmd(first, -((weekdayOf(first) + 6) % 7));
    const [y, m] = date.split("-").map(Number);
    const last = `${date.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
    end = addDaysYmd(last, (7 - ((weekdayOf(last) + 6) % 7) - 1));
  } else if (view === "week") {
    start = addDaysYmd(date, -((weekdayOf(date) + 6) % 7));
    end = addDaysYmd(start, 6);
  } else {
    start = end = date;
  }
  const rangeStart = new Date(zonedToEpoch(start, "00:00", tz));
  const rangeEnd = new Date(zonedToEpoch(addDaysYmd(end, 1), "00:00", tz));

  const [bookings, exceptions, weekly] = await Promise.all([
    query<B>(`select b.id, b.starts_at, b.ends_at, b.status, b.lesson_name, s.full_name from bookings b join students s on s.id = b.student_id
              where b.starts_at < $2 and b.ends_at > $1 and b.status in ('pending','confirmed','completed','no_show') order by b.starts_at`, [rangeStart, rangeEnd]),
    query<X>("select id, kind, starts_at, ends_at, note from schedule_exceptions where starts_at < $2 and ends_at > $1 order by starts_at", [rangeStart, rangeEnd]),
    query<{ weekday: number; start_time: string; end_time: string }>("select weekday, start_time::text, end_time::text from weekly_hours"),
  ]);

  const days: string[] = [];
  for (let d = start; d <= end; d = addDaysYmd(d, 1)) days.push(d);
  const dayOf = (d: Date) => fmtTz(d, "yyyy-MM-dd", tz);
  const byDay = new Map<string, B[]>();
  for (const b of bookings) byDay.set(dayOf(b.starts_at), [...(byDay.get(dayOf(b.starts_at)) ?? []), b]);
  const avInput = { timezone: tz, weekly, exceptions };

  const step = view === "month" ? 31 : view === "week" ? 7 : 1;
  const nav = (d: string) => `/admin/calendar?view=${view}&date=${d}`;
  const prev = view === "month" ? shiftMonth(date, -1) : addDaysYmd(date, -step);
  const next = view === "month" ? shiftMonth(date, 1) : addDaysYmd(date, step);
  const title = view === "month" ? fmtTz(new Date(zonedToEpoch(date, "12:00", tz)), "MMMM yyyy", tz)
    : view === "week" ? `${fmtTz(rangeStart, "d MMM", tz)} – ${fmtTz(new Date(+rangeEnd - 1), "d MMM yyyy", tz)}`
    : fmtTz(rangeStart, "EEEE d MMMM yyyy", tz);
  const returnTo = `/admin/calendar?view=${view}&date=${date}`;

  // Time axis for week/day views.
  let minH = 8, maxH = 18;
  for (const w of weekly) { minH = Math.min(minH, Number(w.start_time.slice(0, 2))); maxH = Math.max(maxH, Math.ceil(Number(w.end_time.slice(0, 2)) + Number(w.end_time.slice(3, 5)) / 60)); }
  for (const b of bookings) { minH = Math.min(minH, Number(fmtTz(b.starts_at, "H", tz))); maxH = Math.max(maxH, Number(fmtTz(b.ends_at, "H", tz)) + 1); }
  maxH = Math.min(24, maxH);
  const HOUR = 56;
  const minutesOf = (ms: number, d: string) => (ms - zonedToEpoch(d, "00:00", tz)) / 60000;

  return (
    <>
      <PageHeader title="Calendar" sub="Bookings, working hours and time off." actions={<Link href="/admin/availability" className="btn btn-ghost btn-sm"><Icon name="clock-circle-linear" size={18} />Working hours</Link>} />
      <Flash ok={sp.ok} error={sp.error} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={nav(prev)} className="grid size-10 place-items-center rounded-full bg-paper shadow-[0_0_0_1px_var(--color-line)] hover:bg-mist" aria-label="Previous"><Icon name="alt-arrow-left-linear" size={18} /></Link>
          <Link href={nav(next)} className="grid size-10 place-items-center rounded-full bg-paper shadow-[0_0_0_1px_var(--color-line)] hover:bg-mist" aria-label="Next"><Icon name="alt-arrow-right-linear" size={18} /></Link>
          <Link href={nav(today)} className="btn btn-ghost btn-sm">Today</Link>
          <h2 className="ml-2 text-lg font-semibold" aria-live="polite">{title}</h2>
        </div>
        <div className="flex gap-1 rounded-full bg-mist p-1 text-[14px] font-medium" role="tablist" aria-label="Calendar view">
          {(["month", "week", "day"] as const).map((v) => (
            <Link key={v} role="tab" aria-selected={view === v} href={`/admin/calendar?view=${v}&date=${date}`} className={`rounded-full px-4 py-1.5 capitalize ${view === v ? "bg-paper shadow-sm" : "text-muted hover:text-ink"}`}>{v}</Link>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-[12px] text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-accent" />Confirmed</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-warn-soft ring-1 ring-warn/30" />Pending</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-accent-soft" />Working hours</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[repeating-linear-gradient(45deg,#e3e3e8,#e3e3e8_3px,#f5f5f7_3px,#f5f5f7_6px)]" />Blocked</span>
      </div>

      {view === "month" ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-mist/50 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.slice(0, 7) === date.slice(0, 7);
              const list = byDay.get(d) ?? [];
              const working = workingWindows(d, avInput).length > 0;
              const blocked = exceptions.some((x) => x.kind === "block" && +x.starts_at <= zonedToEpoch(d, "00:00", tz) && +x.ends_at >= zonedToEpoch(addDaysYmd(d, 1), "00:00", tz));
              return (
                <Link key={d} href={`/admin/calendar?view=day&date=${d}`} className={`group min-h-[92px] border-b border-r border-line p-1.5 transition hover:bg-mist/60 sm:min-h-[120px] sm:p-2 ${!inMonth ? "bg-mist/30 text-faint" : ""} ${blocked ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,.035)_6px,rgba(0,0,0,.035)_12px)]" : ""}`} aria-label={`${d}: ${list.length} bookings${blocked ? ", blocked" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums ${d === today ? "bg-accent text-white" : ""}`}>{Number(d.slice(8))}</span>
                    {working && inMonth && !blocked && <span className="size-1.5 rounded-full bg-accent/60" title="Working day" />}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {list.slice(0, 3).map((b) => (
                      <li key={b.id} className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BLOCK[b.status]}`}>
                        <span className="tabular-nums">{fmtTz(b.starts_at, "HH:mm", tz)}</span><span className="hidden sm:inline"> {b.full_name.split(" ")[0]}</span>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1.5 text-[11px] text-muted">+{list.length - 3} more</li>}
                  </ul>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <div className={`grid ${view === "week" ? "min-w-[760px] grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_1fr]"}`}>
            <div className="border-b border-line" />
            {days.map((d) => (
              <Link key={d} href={`/admin/calendar?view=day&date=${d}`} className={`border-b border-l border-line py-2 text-center text-[12px] hover:bg-mist/60 ${d === today ? "text-accent" : "text-muted"}`}>
                <span className="block font-semibold uppercase tracking-[0.06em]">{fmtTz(new Date(zonedToEpoch(d, "12:00", tz)), "EEE", tz)}</span>
                <span className={`mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-[15px] font-bold tabular-nums ${d === today ? "bg-accent text-white" : "text-ink"}`}>{Number(d.slice(8))}</span>
              </Link>
            ))}
            <div className="relative" style={{ height: (maxH - minH) * HOUR }}>
              {Array.from({ length: maxH - minH }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-faint" style={{ top: i * HOUR }}>{i === 0 ? "" : `${String(minH + i).padStart(2, "0")}:00`}</span>
              ))}
            </div>
            {days.map((d) => {
              const off = minH * 60;
              const pos = (a: number, b: number) => ({ top: Math.max(0, (a - off) / 60 * HOUR), height: Math.max(18, (b - a) / 60 * HOUR) });
              return (
                <div key={d} className="relative border-l border-line" style={{ height: (maxH - minH) * HOUR }}>
                  {Array.from({ length: maxH - minH }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR }} />)}
                  {workingWindows(d, { ...avInput, exceptions: exceptions.filter((x) => x.kind === "open") }).map((w, i) => {
                    const p = pos(minutesOf(w.start, d), minutesOf(w.end, d));
                    return <div key={`w${i}`} className="absolute inset-x-0 bg-accent-soft/60" style={p} aria-hidden="true" />;
                  })}
                  {exceptions.filter((x) => x.kind === "block").map((x) => {
                    const a = Math.max(0, minutesOf(+x.starts_at, d)), b = Math.min(1440, minutesOf(+x.ends_at, d));
                    if (b <= 0 || a >= 1440) return null;
                    const p = pos(a, b);
                    return <div key={x.id} className="absolute inset-x-0 overflow-hidden bg-[repeating-linear-gradient(45deg,#ebebef,#ebebef_4px,#f7f7f9_4px,#f7f7f9_8px)] px-1.5 py-1 text-[11px] text-muted" style={p} title={x.note ?? "Blocked"}>{x.note ?? "Blocked"}</div>;
                  })}
                  {(byDay.get(d) ?? []).map((b) => {
                    const p = pos(minutesOf(+b.starts_at, d), minutesOf(+b.ends_at, d));
                    return (
                      <Link key={b.id} href={`/admin/bookings/${b.id}`} className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-[12px] leading-tight shadow-sm transition hover:brightness-95 ${STATUS_BLOCK[b.status]}`} style={p}>
                        <span className="block font-semibold tabular-nums">{fmtTz(b.starts_at, "HH:mm", tz)}–{fmtTz(b.ends_at, "HH:mm", tz)}</span>
                        <span className="block truncate">{b.full_name}</span>
                        {view === "day" && <span className="block truncate opacity-80">{b.lesson_name}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="card p-6" aria-labelledby="block-h">
          <h2 id="block-h" className="font-semibold">Block out time or add availability</h2>
          <p className="mt-1 text-[14px] text-muted">Holidays, appointments or one-off extra hours.</p>
          <form action={addExceptionAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="return_to" value={returnTo} />
            <div className="sm:col-span-2 flex gap-4 text-[14px]">
              <label className="flex items-center gap-2"><input type="radio" name="kind" value="block" defaultChecked className="accent-[var(--color-accent)]" />Unavailable</label>
              <label className="flex items-center gap-2"><input type="radio" name="kind" value="open" className="accent-[var(--color-accent)]" />Extra availability</label>
            </div>
            <div><label className="field-label" htmlFor="from_date">From</label><input id="from_date" name="from_date" type="date" required defaultValue={date} className="field" /></div>
            <div><label className="field-label" htmlFor="to_date">To</label><input id="to_date" name="to_date" type="date" defaultValue={date} className="field" /></div>
            <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" name="all_day" className="size-4 accent-[var(--color-accent)]" />All day (e.g. holiday)</label>
            <div><label className="field-label" htmlFor="from_time">Start time</label><input id="from_time" name="from_time" type="time" step={300} defaultValue="09:00" className="field" /></div>
            <div><label className="field-label" htmlFor="to_time">End time</label><input id="to_time" name="to_time" type="time" step={300} defaultValue="17:00" className="field" /></div>
            <div className="sm:col-span-2"><label className="field-label" htmlFor="note">Note (private)</label><input id="note" name="note" maxLength={200} className="field" placeholder="e.g. Holiday" /></div>
            <div className="sm:col-span-2"><SubmitButton>Save</SubmitButton></div>
          </form>
        </section>
        <section className="card p-6" aria-labelledby="exc-h">
          <h2 id="exc-h" className="mb-4 font-semibold">Time off &amp; extra hours in this view</h2>
          {exceptions.length ? (
            <ul className="divide-y divide-line">
              {exceptions.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-3 text-[14px]">
                  <span><span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.kind === "block" ? "bg-mist text-ink-2" : "bg-accent-soft text-accent-ink"}`}>{x.kind === "block" ? "Blocked" : "Extra"}</span>
                    {fmtTz(x.starts_at, "d MMM HH:mm", tz)} – {fmtTz(x.ends_at, "d MMM HH:mm", tz)}{x.note && <span className="text-muted"> · {x.note}</span>}</span>
                  <form action={deleteExceptionAction}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="return_to" value={returnTo} />
                    <SubmitButton className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" pendingText="" confirm="Remove this?"><Icon name="trash-bin-trash-linear" size={18} label="Remove" /></SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-muted">Nothing in this period.</p>}
          {view === "day" && <Link href={`/admin/bookings/new?date=${date}`} className="btn btn-ghost btn-sm mt-5"><Icon name="add-circle-linear" size={18} />Add a booking on this day</Link>}
        </section>
      </div>
    </>
  );
}

function shiftMonth(date: string, n: number) {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
