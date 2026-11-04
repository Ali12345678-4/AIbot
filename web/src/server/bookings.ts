import "server-only";
import type { PoolClient } from "pg";
import { query, queryOne, tx } from "./db";
import { getSettings, getLessonType } from "./settings";
import { expireUnpaidHolds, loadAvailabilityInput } from "./schedule";
import { slotsForDate, todayInTz } from "@/lib/availability";
import { fmtTz } from "@/lib/format";
import type { CreateBookingInput } from "@/lib/validation";
import type { BookingStatus, PaymentMode, PaymentStatus, Settings } from "@/lib/types";
import { hashToken, newManageToken, newReference } from "./tokens";
import { sendBookingEmails, type BookingEmailData } from "./emails";
import * as payments from "./payments";
import { siteUrl } from "@/lib/site";

export class BookingError extends Error {
  constructor(public code: string, message: string, public field?: string) {
    super(message);
  }
}

const isOverlap = (e: unknown) => (e as { code?: string })?.code === "23P01";

export function effectivePaymentMode(s: Settings): PaymentMode {
  return s.payment_mode !== "pay_at_lesson" && payments.paymentsAvailable() ? s.payment_mode : "pay_at_lesson";
}

export function amountDue(mode: PaymentMode, price: number, s: Settings) {
  if (mode === "full") return price;
  if (mode === "deposit") return Math.min(price, s.deposit_pence);
  return 0;
}

async function logEvent(c: PoolClient | null, bookingId: string, actor: string, action: string, detail?: object) {
  const sql = "insert into booking_events (booking_id, actor, action, detail) values ($1,$2,$3,$4)";
  const p = [bookingId, actor, action, detail ? JSON.stringify(detail) : null];
  if (c) await c.query(sql, p);
  else await query(sql, p);
}

export async function bookingEmailData(id: string) {
  return queryOne<BookingEmailData & { require_token?: string }>(
    `select b.id, b.reference, b.lesson_name, b.duration_minutes, b.price_pence, b.starts_at, b.status,
            b.payment_mode, b.payment_status, b.amount_due_pence, b.experience, b.student_message,
            s.full_name as student_name, s.email as student_email, s.phone as student_phone
     from bookings b join students s on s.id = b.student_id where b.id = $1`,
    [id],
  );
}

async function rotateManageToken(bookingId: string) {
  const token = newManageToken();
  await query("update bookings set manage_token_hash = $2 where id = $1", [bookingId, hashToken(token)]);
  return token;
}

// ---------------------------------------------------------------------------
// Public: create a booking
// ---------------------------------------------------------------------------

export async function createBooking(input: CreateBookingInput) {
  const settings = await getSettings();
  const lesson = await getLessonType(input.lessonTypeId);
  if (!lesson || !lesson.active) throw new BookingError("lesson_unavailable", "That lesson is no longer available.", "lessonTypeId");

  await expireUnpaidHolds();

  const start = new Date(input.startsAt);
  const date = fmtTz(start, "yyyy-MM-dd", settings.timezone);
  if (date < todayInTz(settings.timezone)) throw new BookingError("slot_unavailable", "That time is in the past.", "startsAt");

  const mode = effectivePaymentMode(settings);
  const due = amountDue(mode, lesson.price_pence, settings);
  const needsPayment = mode !== "pay_at_lesson" && due > 0;
  const token = newManageToken();
  const end = new Date(start.getTime() + lesson.duration_minutes * 60_000);
  const blockedUntil = new Date(end.getTime() + settings.buffer_minutes * 60_000);

  let booking: { id: string; reference: string };
  try {
    booking = await tx(async (c) => {
      // Re-validate the slot against live data inside the transaction.
      const avail = await loadAvailabilityInput(settings, date, date, lesson.duration_minutes, { client: c });
      if (!slotsForDate(date, avail).includes(start.getTime())) {
        throw new BookingError("slot_unavailable", "Sorry, that time has just been taken or is no longer available. Please choose another.", "startsAt");
      }
      const student = await c.query<{ id: string }>(
        `insert into students (full_name, email, phone, experience) values ($1, lower($2), $3, $4)
         on conflict ((lower(email))) do update set full_name = excluded.full_name, phone = excluded.phone,
           experience = excluded.experience, updated_at = now()
         returning id`,
        [input.fullName, input.email, input.phone, input.experience],
      );
      const status: BookingStatus = settings.require_approval || needsPayment ? "pending" : "confirmed";
      const paymentStatus: PaymentStatus = mode === "pay_at_lesson" ? "unpaid" : due > 0 ? "unpaid" : "not_required";
      for (let attempt = 0; ; attempt++) {
        try {
          await c.query("savepoint ins");
          const r = await c.query<{ id: string; reference: string }>(
            `insert into bookings (reference, student_id, lesson_type_id, lesson_name, duration_minutes, price_pence,
               starts_at, ends_at, blocked_until, status, experience, student_message, payment_mode, payment_status,
               amount_due_pence, manage_token_hash)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id, reference`,
            [newReference(), student.rows[0].id, lesson.id, lesson.name, lesson.duration_minutes, lesson.price_pence,
             start, end, blockedUntil, status, input.experience, input.message || null, mode, paymentStatus, due, hashToken(token)],
          );
          await c.query("release savepoint ins");
          await logEvent(c, r.rows[0].id, "student", "created", { status });
          return r.rows[0];
        } catch (e) {
          await c.query("rollback to savepoint ins");
          if ((e as { code?: string }).code === "23505" && attempt < 3) continue; // reference collision
          throw e;
        }
      }
    });
  } catch (e) {
    if (isOverlap(e)) throw new BookingError("slot_unavailable", "Sorry, that time has just been taken. Please choose another.", "startsAt");
    throw e;
  }

  if (needsPayment) {
    try {
      const checkout = await payments.createCheckout({
        bookingId: booking.id,
        reference: booking.reference,
        description: `${lesson.name} – ${fmtTz(start, "EEE d MMM, HH:mm", settings.timezone)}${mode === "deposit" ? " (deposit)" : ""}`,
        amountPence: due,
        currency: settings.currency,
        email: input.email,
        manualCapture: settings.require_approval,
        successUrl: `${siteUrl()}/book/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteUrl()}/book?cancelled=${booking.reference}`,
      });
      await query("insert into payments (booking_id, provider, provider_ref, amount_pence, status) values ($1,'stripe',$2,$3,'created')", [booking.id, checkout.id, due]);
      return { reference: booking.reference, checkoutUrl: checkout.url };
    } catch (e) {
      await query("update bookings set status='cancelled', cancelled_at=now(), cancelled_by='system', cancel_reason='Payment could not be started' where id=$1", [booking.id]);
      console.error("[booking] checkout failed", e);
      throw new BookingError("payment_failed", "We couldn’t start the payment. Please try again in a moment.");
    }
  }

  const data = await bookingEmailData(booking.id);
  if (data) await sendBookingEmails("received", data, settings, { manageToken: token });
  return { reference: booking.reference, manageToken: token, status: data?.status ?? "pending" };
}

/** Called from the Stripe webhook and the return page. Idempotent. */
export async function confirmCheckout(sessionId: string) {
  const st = await payments.checkoutStatus(sessionId);
  if (!st.bookingId || st.status === "unpaid") return null;
  const settings = await getSettings();
  const changed = await tx(async (c) => {
    const b = await c.query<{ id: string; payment_status: string; status: string }>(
      "select id, payment_status, status from bookings where id = $1 for update", [st.bookingId]);
    const row = b.rows[0];
    if (!row || row.payment_status !== "unpaid") return false;
    if (row.status === "cancelled") {
      // Hold expired before payment completed; release/refund automatically.
      if (st.paymentIntentId) {
        if (st.status === "authorised") await payments.release(st.paymentIntentId).catch(() => {});
        else await payments.refund(st.paymentIntentId).catch(() => {});
      }
      return false;
    }
    const newStatus = !settings.require_approval && st.status === "paid" ? "confirmed" : row.status;
    await c.query("update bookings set payment_status = $2, status = $3, updated_at = now() where id = $1", [row.id, st.status, newStatus]);
    await c.query("update payments set status = $2, provider_payment_id = $3, updated_at = now() where provider = 'stripe' and provider_ref = $1",
      [sessionId, st.status, st.paymentIntentId]);
    await logEvent(c, row.id, "system", `payment_${st.status}`);
    return true;
  });
  if (changed) {
    const token = await rotateManageToken(st.bookingId);
    const data = await bookingEmailData(st.bookingId);
    if (data) await sendBookingEmails("received", data, settings, { manageToken: token });
  }
  return queryOne<{ reference: string; status: string; starts_at: Date; lesson_name: string; payment_status: string }>(
    "select reference, status, starts_at, lesson_name, payment_status from bookings where id = $1", [st.bookingId]);
}

// ---------------------------------------------------------------------------
// Admin + student lifecycle
// ---------------------------------------------------------------------------

async function paymentIntentFor(bookingId: string) {
  const p = await queryOne<{ provider_payment_id: string | null }>(
    "select provider_payment_id from payments where booking_id = $1 and provider = 'stripe' order by created_at desc limit 1", [bookingId]);
  return p?.provider_payment_id ?? null;
}

async function settleMoney(bookingId: string, action: "capture" | "release_or_refund") {
  const b = await queryOne<{ payment_status: PaymentStatus }>("select payment_status from bookings where id = $1", [bookingId]);
  const pi = await paymentIntentFor(bookingId);
  if (!b || !pi) return;
  if (action === "capture" && b.payment_status === "authorised") {
    await payments.capture(pi);
    await query("update bookings set payment_status = 'paid' where id = $1", [bookingId]);
    await query("update payments set status='paid', updated_at=now() where provider_payment_id = $1", [pi]);
  } else if (action === "release_or_refund") {
    if (b.payment_status === "authorised") {
      await payments.release(pi);
      await query("update bookings set payment_status = 'unpaid' where id = $1", [bookingId]);
      await query("update payments set status='cancelled', updated_at=now() where provider_payment_id = $1", [pi]);
    } else if (b.payment_status === "paid") {
      await payments.refund(pi);
      await query("update bookings set payment_status = 'refunded' where id = $1", [bookingId]);
      await query("update payments set status='refunded', updated_at=now() where provider_payment_id = $1", [pi]);
    }
  }
}

async function transition(id: string, from: BookingStatus[], to: BookingStatus, extra: { by?: string; reason?: string } = {}) {
  const r = await queryOne<{ id: string }>(
    `update bookings set status = $3, updated_at = now(),
       cancelled_at = case when $3 in ('cancelled','rejected') then now() else cancelled_at end,
       cancelled_by = case when $3 in ('cancelled','rejected') then $4 else cancelled_by end,
       cancel_reason = case when $3 in ('cancelled','rejected') then $5 else cancel_reason end
     where id = $1 and status = any($2::text[]) returning id`,
    [id, from, to, extra.by ?? null, extra.reason ?? null],
  );
  if (!r) throw new BookingError("invalid_state", "This booking can’t be changed from its current status.");
  await logEvent(null, id, extra.by ?? "admin", to, extra.reason ? { reason: extra.reason } : undefined);
}

export async function approveBooking(id: string) {
  const settings = await getSettings();
  const b = await queryOne<{ payment_mode: string; payment_status: string; amount_due_pence: number }>(
    "select payment_mode, payment_status, amount_due_pence from bookings where id = $1", [id]);
  if (b && b.payment_mode !== "pay_at_lesson" && b.amount_due_pence > 0 && b.payment_status === "unpaid") {
    throw new BookingError("unpaid", "This booking hasn’t been paid yet, so it can’t be confirmed.");
  }
  await transition(id, ["pending"], "confirmed");
  await settleMoney(id, "capture");
  const data = await bookingEmailData(id);
  if (data) await sendBookingEmails("confirmed", data, settings, { manageToken: await rotateManageToken(id) });
}

export async function rejectBooking(id: string, reason?: string) {
  const settings = await getSettings();
  await transition(id, ["pending"], "rejected", { by: "admin", reason });
  await settleMoney(id, "release_or_refund");
  const data = await bookingEmailData(id);
  if (data) await sendBookingEmails("rejected", data, settings, { reason });
}

export async function adminCancelBooking(id: string, reason?: string, notify = true) {
  const settings = await getSettings();
  await transition(id, ["pending", "confirmed"], "cancelled", { by: "admin", reason });
  await settleMoney(id, "release_or_refund");
  const data = await bookingEmailData(id);
  if (data && notify) await sendBookingEmails("cancelled_by_admin", data, settings, { reason });
}

export async function setOutcome(id: string, to: "completed" | "no_show" | "confirmed") {
  await transition(id, to === "confirmed" ? ["completed", "no_show"] : ["confirmed"], to);
}

export async function setPaymentStatus(id: string, status: PaymentStatus) {
  await query("update bookings set payment_status = $2, updated_at = now() where id = $1", [id, status]);
  await logEvent(null, id, "admin", "payment_status", { status });
}

/** Admin edit/reschedule. Admin may book outside normal hours; overlap is still prevented. */
export async function updateBooking(id: string, patch: { startsAt: Date; durationMinutes: number; lessonTypeId: string | null; lessonName: string; pricePence: number; adminNotes: string; notify: boolean }) {
  const settings = await getSettings();
  const before = await queryOne<{ starts_at: Date; duration_minutes: number; lesson_name: string; price_pence: number; status: string }>(
    "select starts_at, duration_minutes, lesson_name, price_pence, status from bookings where id = $1", [id]);
  if (!before) throw new BookingError("not_found", "Booking not found.");
  const end = new Date(patch.startsAt.getTime() + patch.durationMinutes * 60_000);
  const blocked = new Date(end.getTime() + settings.buffer_minutes * 60_000);
  try {
    await query(
      `update bookings set starts_at=$2, ends_at=$3, blocked_until=$4, duration_minutes=$5, lesson_type_id=$6,
         lesson_name=$7, price_pence=$8, admin_notes=$9, updated_at=now() where id=$1`,
      [id, patch.startsAt, end, blocked, patch.durationMinutes, patch.lessonTypeId, patch.lessonName, patch.pricePence, patch.adminNotes],
    );
  } catch (e) {
    if (isOverlap(e)) throw new BookingError("slot_unavailable", "That time overlaps another booking.");
    throw e;
  }
  const changedLesson = +before.starts_at !== +patch.startsAt || before.duration_minutes !== patch.durationMinutes || before.lesson_name !== patch.lessonName || before.price_pence !== patch.pricePence;
  if (changedLesson) {
    await logEvent(null, id, "admin", "updated", { from: { starts_at: before.starts_at, duration: before.duration_minutes, lesson: before.lesson_name } });
    if (patch.notify && ["pending", "confirmed"].includes(before.status)) {
      const data = await bookingEmailData(id);
      if (data) await sendBookingEmails("updated", data, settings, { manageToken: await rotateManageToken(id) });
    }
  }
}

// ---------------------------------------------------------------------------
// Student self-service via emailed link
// ---------------------------------------------------------------------------

export async function bookingByToken(token: string) {
  if (!token || token.length < 20) return null;
  return queryOne<{
    id: string; reference: string; lesson_name: string; duration_minutes: number; price_pence: number;
    starts_at: Date; status: BookingStatus; payment_mode: string; payment_status: PaymentStatus; amount_due_pence: number; student_name: string;
  }>(
    `select b.id, b.reference, b.lesson_name, b.duration_minutes, b.price_pence, b.starts_at, b.status,
            b.payment_mode, b.payment_status, b.amount_due_pence, s.full_name as student_name
     from bookings b join students s on s.id = b.student_id where b.manage_token_hash = $1`,
    [hashToken(token)],
  );
}

export function canStudentCancel(startsAt: Date, s: Settings, now = new Date()) {
  return startsAt.getTime() - now.getTime() >= s.cancellation_notice_hours * 3_600_000;
}

export async function studentCancel(token: string) {
  const settings = await getSettings();
  const b = await bookingByToken(token);
  if (!b) throw new BookingError("not_found", "We couldn’t find that booking.");
  if (!["pending", "confirmed"].includes(b.status)) throw new BookingError("invalid_state", "This booking is no longer active.");
  if (!canStudentCancel(new Date(b.starts_at), settings)) {
    throw new BookingError("too_late", `Online cancellation closes ${settings.cancellation_notice_hours} hours before the lesson. Please contact the instructor directly.`);
  }
  await transition(b.id, ["pending", "confirmed"], "cancelled", { by: "student" });
  await settleMoney(b.id, "release_or_refund");
  const data = await bookingEmailData(b.id);
  if (data) await sendBookingEmails("cancelled_by_student", data, settings);
}
