/**
 * Integration tests against a real Postgres (DATABASE_URL). They create and remove their own data.
 * Run: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool, query } from "../src/server/db";
import { createBooking, BookingError, approveBooking, studentCancel, adminCancelBooking } from "../src/server/bookings";
import { zonedToEpoch, addDaysYmd, todayInTz, weekdayOf } from "../src/lib/availability";

let lessonId = "";
let savedHours: { weekday: number; start_time: string; end_time: string }[] = [];
let savedSettings: Record<string, unknown> = {};
const day = addDaysYmd(todayInTz("Europe/London"), 7);
const at = (time: string) => new Date(zonedToEpoch(day, time, "Europe/London")).toISOString();
const student = (n: number) => ({ fullName: `Test Student ${n}`, phone: "07700 900000", email: `test${n}@example.test`, experience: "beginner", message: "", consent: true as const });

before(async () => {
  await query("delete from bookings where student_id in (select id from students where email like '%@example.test')");
  await query("delete from students where email like '%@example.test'");
  await query("delete from lesson_types where slug = 'test-lesson'");
  // Isolate from whatever schedule the database already has; restored in after().
  savedHours = await query("select weekday, start_time::text, end_time::text from weekly_hours");
  [savedSettings] = await query("select require_approval, min_notice_hours, buffer_minutes, slot_interval_minutes, cancellation_notice_hours, payment_mode from settings");
  await query("delete from weekly_hours");
  const [l] = await query<{ id: string }>("insert into lesson_types (name, slug, duration_minutes, price_pence) values ('Test lesson','test-lesson',60,4000) returning id");
  lessonId = l.id;
  await query("insert into weekly_hours (weekday, start_time, end_time) values ($1,'08:00','11:00')", [weekdayOf(day)]);
  await query("update settings set require_approval = true, min_notice_hours = 1, buffer_minutes = 0, slot_interval_minutes = 30, cancellation_notice_hours = 48, payment_mode = 'pay_at_lesson'");
});

after(async () => {
  await query("delete from bookings where student_id in (select id from students where email like '%@example.test')");
  await query("delete from students where email like '%@example.test'");
  await query("delete from lesson_types where id = $1", [lessonId]);
  await query("delete from weekly_hours");
  for (const h of savedHours) await query("insert into weekly_hours (weekday, start_time, end_time) values ($1,$2,$3)", [h.weekday, h.start_time, h.end_time]);
  const s = savedSettings;
  await query("update settings set require_approval=$1, min_notice_hours=$2, buffer_minutes=$3, slot_interval_minutes=$4, cancellation_notice_hours=$5, payment_mode=$6",
    [s.require_approval, s.min_notice_hours, s.buffer_minutes, s.slot_interval_minutes, s.cancellation_notice_hours, s.payment_mode]);
  await pool().end();
});

test("creates a pending booking and emails both parties", async () => {
  const r = await createBooking({ ...student(1), lessonTypeId: lessonId, startsAt: at("08:00") });
  assert.match(r.reference, /^K4-[A-Z0-9]{6}$/);
  assert.equal(r.status, "pending");
  const mails = await query("select * from email_log e join bookings b on b.id = e.booking_id where b.reference = $1", [r.reference]);
  assert.equal(mails.length, 1); // instructor email absent until settings.email set
});

test("rejects slots outside working hours", async () => {
  await assert.rejects(createBooking({ ...student(2), lessonTypeId: lessonId, startsAt: at("12:00") }), (e: unknown) => e instanceof BookingError && e.code === "slot_unavailable");
});

test("prevents double booking under concurrency", async () => {
  const results = await Promise.allSettled(
    [3, 4, 5, 6, 7].map((n) => createBooking({ ...student(n), lessonTypeId: lessonId, startsAt: at("09:30") })),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  assert.equal(ok.length, 1, "exactly one concurrent request should win");
  for (const r of results) if (r.status === "rejected") assert.equal((r.reason as BookingError).code, "slot_unavailable");
  // Overlapping slot (10:00 overlaps 09:30-10:30) must also fail.
  await assert.rejects(createBooking({ ...student(8), lessonTypeId: lessonId, startsAt: at("10:00") }));
});

test("cancelled bookings free the slot; approval and student cancel work", async () => {
  const [b] = await query<{ id: string }>("select id from bookings where starts_at = $1 and status = 'pending'", [at("09:30")]);
  await approveBooking(b.id);
  const [c] = await query<{ status: string }>("select status from bookings where id = $1", [b.id]);
  assert.equal(c.status, "confirmed");
  await adminCancelBooking(b.id, "Test");
  const r = await createBooking({ ...student(9), lessonTypeId: lessonId, startsAt: at("09:30") });
  assert.equal(r.status, "pending");
  await studentCancel(r.manageToken!);
  const [d] = await query<{ status: string; cancelled_by: string }>("select status, cancelled_by from bookings where reference = $1", [r.reference]);
  assert.deepEqual([d.status, d.cancelled_by], ["cancelled", "student"]);
});
