import { test } from "node:test";
import assert from "node:assert/strict";
import { slotsForDate, zonedToEpoch, workingWindows, type AvailabilityInput } from "../src/lib/availability";

const TZ = "Europe/London";
const base = (over: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  timezone: TZ,
  weekly: [{ weekday: 3, start_time: "09:00", end_time: "12:00" }], // Wednesdays
  exceptions: [],
  busy: [],
  durationMinutes: 60,
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 0,
  maxAdvanceDays: 60,
  now: new Date("2026-11-01T00:00:00Z"),
  ...over,
});
const t = (date: string, time: string) => zonedToEpoch(date, time, TZ);
const labels = (ms: number[]) => ms.map((m) => new Date(m).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }));

test("generates slots inside working hours only", () => {
  assert.deepEqual(labels(slotsForDate("2026-11-04", base())), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
  assert.deepEqual(slotsForDate("2026-11-05", base()), []); // Thursday: no hours
});

test("existing bookings remove overlapping slots", () => {
  const busy = [{ start: t("2026-11-04", "10:00"), end: t("2026-11-04", "11:00") }];
  assert.deepEqual(labels(slotsForDate("2026-11-04", base({ busy }))), ["09:00", "11:00"]);
});

test("buffer is enforced between lessons", () => {
  const busy = [{ start: t("2026-11-04", "11:00"), end: t("2026-11-04", "12:00") }];
  assert.deepEqual(labels(slotsForDate("2026-11-04", base({ busy, bufferMinutes: 30 }))), ["09:00", "09:30"]);
});

test("blocks remove time and open exceptions add time", () => {
  const exceptions = [
    { kind: "block" as const, starts_at: new Date(t("2026-11-04", "09:00")), ends_at: new Date(t("2026-11-04", "10:30")) },
    { kind: "open" as const, starts_at: new Date(t("2026-11-05", "14:00")), ends_at: new Date(t("2026-11-05", "15:00")) },
  ];
  assert.deepEqual(labels(slotsForDate("2026-11-04", base({ exceptions }))), ["10:30", "11:00"]);
  assert.deepEqual(labels(slotsForDate("2026-11-05", base({ exceptions }))), ["14:00"]);
});

test("whole-day holiday blocks everything", () => {
  const exceptions = [{ kind: "block" as const, starts_at: new Date(t("2026-11-04", "00:00")), ends_at: new Date(t("2026-11-05", "00:00")) }];
  assert.deepEqual(workingWindows("2026-11-04", base({ exceptions })), []);
});

test("minimum notice and max advance are respected", () => {
  const now = new Date(t("2026-11-04", "08:30"));
  assert.deepEqual(labels(slotsForDate("2026-11-04", base({ now, minNoticeHours: 2 }))), ["10:30", "11:00"]);
  assert.deepEqual(slotsForDate("2027-02-03", base({ now })), []);
  assert.deepEqual(slotsForDate("2026-11-03", base({ now })), []); // past
});

test("handles DST change (clocks go back 25 Oct 2026)", () => {
  const weekly = [{ weekday: 0, start_time: "09:00", end_time: "10:00" }];
  const now = new Date("2026-10-01T00:00:00Z");
  const [slot] = slotsForDate("2026-10-25", base({ weekly, now }));
  assert.equal(new Date(slot).toISOString(), "2026-10-25T09:00:00.000Z"); // GMT after change
  const [summer] = slotsForDate("2026-10-18", base({ weekly, now }));
  assert.equal(new Date(summer).toISOString(), "2026-10-18T08:00:00.000Z"); // BST
});
