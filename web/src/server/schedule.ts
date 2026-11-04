import "server-only";
import { query } from "./db";
import type { AvailabilityInput, Interval } from "@/lib/availability";
import { zonedToEpoch, addDaysYmd } from "@/lib/availability";
import type { Settings } from "@/lib/types";
import type { PoolClient } from "pg";

/** Release slots held by bookings whose online payment was never completed. */
export const PAYMENT_HOLD_MINUTES = 30;

export async function expireUnpaidHolds() {
  await query(
    `update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'system',
       cancel_reason = 'Online payment was not completed', updated_at = now()
     where status = 'pending' and payment_mode <> 'pay_at_lesson' and payment_status = 'unpaid'
       and created_at < now() - ($1 || ' minutes')::interval`,
    [String(PAYMENT_HOLD_MINUTES)],
  );
}

/** Everything the availability engine needs for local dates [from, to]. */
export async function loadAvailabilityInput(
  settings: Settings,
  from: string,
  to: string,
  durationMinutes: number,
  opts: { excludeBookingId?: string; client?: PoolClient } = {},
): Promise<AvailabilityInput> {
  const tz = settings.timezone;
  const rangeStart = new Date(zonedToEpoch(from, "00:00", tz) - 86_400_000);
  const rangeEnd = new Date(zonedToEpoch(addDaysYmd(to, 1), "00:00", tz) + 86_400_000);
  const run = <T,>(sql: string, p: unknown[]) =>
    opts.client ? opts.client.query(sql, p).then((r) => r.rows as T[]) : query(sql, p).then((r) => r as T[]);

  // A single pg client cannot run queries in parallel, so run sequentially inside transactions.
  const parallel = <T extends unknown[]>(fns: { [K in keyof T]: () => Promise<T[K]> }) =>
    (opts.client ? fns.reduce<Promise<unknown[]>>(async (acc, f) => [...(await acc), await f()], Promise.resolve([])) : Promise.all(fns.map((f) => f()))) as Promise<T>;
  const [weekly, exceptions, busyRows] = await parallel<[
    { weekday: number; start_time: string; end_time: string }[],
    { kind: "block" | "open"; starts_at: Date; ends_at: Date }[],
    { starts_at: Date; blocked_until: Date }[],
  ]>([
    () => run<{ weekday: number; start_time: string; end_time: string }>("select weekday, start_time::text, end_time::text from weekly_hours", []),
    () => run<{ kind: "block" | "open"; starts_at: Date; ends_at: Date }>(
      "select kind, starts_at, ends_at from schedule_exceptions where starts_at < $2 and ends_at > $1",
      [rangeStart, rangeEnd],
    ),
    () => run<{ starts_at: Date; blocked_until: Date }>(
      `select starts_at, blocked_until from bookings
       where status in ('pending','confirmed') and starts_at < $2 and blocked_until > $1
         and ($3::uuid is null or id <> $3::uuid)`,
      [rangeStart, rangeEnd, opts.excludeBookingId ?? null],
    ),
  ]);
  const busy: Interval[] = busyRows.map((b) => ({ start: +b.starts_at, end: +b.blocked_until }));
  return {
    timezone: tz,
    weekly,
    exceptions,
    busy,
    durationMinutes,
    slotIntervalMinutes: settings.slot_interval_minutes,
    bufferMinutes: settings.buffer_minutes,
    minNoticeHours: settings.min_notice_hours,
    maxAdvanceDays: settings.max_advance_days,
    now: new Date(),
  };
}
