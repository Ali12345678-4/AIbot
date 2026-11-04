"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, changePassword } from "@/server/auth";
import { query, queryOne, tx } from "@/server/db";
import { getSettings } from "@/server/settings";
import {
  BookingError, adminCancelBooking, approveBooking, rejectBooking, setOutcome, setPaymentStatus, updateBooking,
} from "@/server/bookings";
import { zonedToEpoch, addDaysYmd } from "@/lib/availability";
import { hashToken, newManageToken, newReference } from "@/server/tokens";
import { bookingEmailData } from "@/server/bookings";
import { sendBookingEmails } from "@/server/emails";
import type { PaymentStatus } from "@/lib/types";

const back = (path: string, msg: { ok?: string; error?: string }) => {
  const q = new URLSearchParams(msg as Record<string, string>).toString();
  redirect(`${path}${path.includes("?") ? "&" : "?"}${q}`);
};

const errMsg = (e: unknown) => (e instanceof BookingError ? e.message : e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid input." : "Something went wrong. Please try again.");

function refreshPublic() {
  revalidatePath("/", "layout");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const pounds = (v: string) => {
  const n = Number(v.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new BookingError("invalid", "Please enter a valid price.");
  return Math.round(n * 100);
};

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export async function bookingAction(fd: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(fd.get("id"));
  const op = str(fd, "op");
  const reason = optStr(fd, "reason") ?? undefined;
  const path = `/admin/bookings/${id}`;
  let ok = "";
  try {
    switch (op) {
      case "approve": await approveBooking(id); ok = "Booking confirmed. The student has been emailed."; break;
      case "reject": await rejectBooking(id, reason); ok = "Booking declined. The student has been emailed."; break;
      case "cancel": await adminCancelBooking(id, reason, fd.get("notify") !== "off"); ok = "Booking cancelled."; break;
      case "completed": await setOutcome(id, "completed"); ok = "Marked as completed."; break;
      case "no_show": await setOutcome(id, "no_show"); ok = "Marked as no-show."; break;
      case "reopen": await setOutcome(id, "confirmed"); ok = "Booking reopened."; break;
      case "payment": {
        const st = z.enum(["unpaid", "paid", "refunded", "not_required"]).parse(fd.get("payment_status")) as PaymentStatus;
        await setPaymentStatus(id, st); ok = "Payment status updated."; break;
      }
      default: throw new BookingError("invalid", "Unknown action.");
    }
  } catch (e) {
    back(path, { error: errMsg(e) });
  }
  revalidatePath("/admin", "layout");
  back(path, { ok });
}

export async function editBookingAction(fd: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(fd.get("id"));
  const path = `/admin/bookings/${id}`;
  try {
    const s = await getSettings();
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.").parse(str(fd, "date"));
    const time = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time.").parse(str(fd, "time"));
    const duration = z.coerce.number().int().min(15).max(600).parse(fd.get("duration"));
    const lessonTypeId = optStr(fd, "lesson_type_id");
    const lesson = lessonTypeId ? await queryOne<{ name: string }>("select name from lesson_types where id = $1", [lessonTypeId]) : null;
    await updateBooking(id, {
      startsAt: new Date(zonedToEpoch(date, time, s.timezone)),
      durationMinutes: duration,
      lessonTypeId: lesson ? lessonTypeId : null,
      lessonName: lesson?.name ?? (str(fd, "lesson_name") || "Driving lesson"),
      pricePence: pounds(str(fd, "price")),
      adminNotes: str(fd, "admin_notes").slice(0, 5000),
      notify: fd.get("notify") === "on",
    });
  } catch (e) {
    back(path, { error: errMsg(e) });
  }
  revalidatePath("/admin", "layout");
  back(path, { ok: "Booking updated." });
}

/** Manual booking, e.g. taken over the phone. Confirmed immediately. */
export async function createManualBookingAction(fd: FormData) {
  await requireAdmin();
  let id = "";
  try {
    const s = await getSettings();
    const d = z.object({
      fullName: z.string().trim().min(2, "Enter the student’s name.").max(100),
      email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email." })),
      phone: z.string().trim().min(7, "Enter a phone number.").max(20),
      lessonTypeId: z.uuid({ error: "Choose a lesson." }),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
      time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
    }).parse(Object.fromEntries(fd));
    const lesson = await queryOne<{ id: string; name: string; duration_minutes: number; price_pence: number }>(
      "select id, name, duration_minutes, price_pence from lesson_types where id = $1", [d.lessonTypeId]);
    if (!lesson) throw new BookingError("invalid", "Lesson not found.");
    const start = new Date(zonedToEpoch(d.date, d.time, s.timezone));
    const end = new Date(+start + lesson.duration_minutes * 60_000);
    const token = newManageToken();
    id = await tx(async (c) => {
      const st = await c.query<{ id: string }>(
        `insert into students (full_name, email, phone) values ($1, $2, $3)
         on conflict ((lower(email))) do update set full_name = excluded.full_name, phone = excluded.phone, updated_at = now() returning id`,
        [d.fullName, d.email, d.phone]);
      const b = await c.query<{ id: string }>(
        `insert into bookings (reference, student_id, lesson_type_id, lesson_name, duration_minutes, price_pence, starts_at, ends_at,
           blocked_until, status, payment_mode, payment_status, manage_token_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed','pay_at_lesson','unpaid',$10) returning id`,
        [newReference(), st.rows[0].id, lesson.id, lesson.name, lesson.duration_minutes, lesson.price_pence, start, end,
         new Date(+end + s.buffer_minutes * 60_000), hashToken(token)]);
      await c.query("insert into booking_events (booking_id, actor, action) values ($1,'admin','created')", [b.rows[0].id]);
      return b.rows[0].id;
    });
    if (fd.get("notify") === "on") {
      const data = await bookingEmailData(id);
      if (data) await sendBookingEmails("confirmed", data, s, { manageToken: token });
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    back("/admin/bookings/new", { error: code === "23P01" ? "That time overlaps another booking." : errMsg(e) });
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/bookings/${id}?ok=${encodeURIComponent("Booking created.")}`);
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function updateStudentAction(fd: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(fd.get("id"));
  try {
    const d = z.object({
      full_name: z.string().trim().min(2).max(100),
      email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email." })),
      phone: z.string().trim().min(7).max(20),
      internal_notes: z.string().max(10000),
    }).parse(Object.fromEntries(fd));
    await query("update students set full_name=$2, email=$3, phone=$4, internal_notes=$5, updated_at=now() where id=$1",
      [id, d.full_name, d.email, d.phone, d.internal_notes]);
  } catch (e) {
    const code = (e as { code?: string }).code;
    back(`/admin/students/${id}`, { error: code === "23505" ? "Another student already uses that email." : errMsg(e) });
  }
  revalidatePath(`/admin/students/${id}`);
  back(`/admin/students/${id}`, { ok: "Student saved." });
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "lesson";

export async function saveLessonAction(fd: FormData) {
  await requireAdmin();
  const id = optStr(fd, "id");
  try {
    const name = z.string().trim().min(2, "Give the lesson a name.").max(80).parse(str(fd, "name"));
    const description = str(fd, "description").slice(0, 600);
    const duration = z.coerce.number({ error: "Enter a duration." }).int().min(15, "Minimum 15 minutes.").max(600).parse(fd.get("duration"));
    const price = pounds(str(fd, "price"));
    const active = fd.get("active") === "on";
    const featured = fd.get("featured") === "on";
    const sort = z.coerce.number().int().min(0).max(999).catch(0).parse(fd.get("sort_order"));
    if (id) {
      await query("update lesson_types set name=$2, description=$3, duration_minutes=$4, price_pence=$5, active=$6, featured=$7, sort_order=$8, updated_at=now() where id=$1",
        [id, name, description, duration, price, active, featured, sort]);
    } else {
      let slug = slugify(name);
      const exists = await queryOne("select 1 from lesson_types where slug = $1", [slug]);
      if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      await query("insert into lesson_types (name, slug, description, duration_minutes, price_pence, active, featured, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [name, slug, description, duration, price, active, featured, sort]);
    }
  } catch (e) {
    back("/admin/lessons", { error: errMsg(e) });
  }
  refreshPublic();
  back("/admin/lessons", { ok: id ? "Lesson saved." : "Lesson created." });
}

export async function deleteLessonAction(fd: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(fd.get("id"));
  const used = await queryOne<{ n: number }>("select count(*)::int n from bookings where lesson_type_id = $1", [id]);
  if (used && used.n > 0) {
    await query("update lesson_types set active = false where id = $1", [id]);
    refreshPublic();
    back("/admin/lessons", { ok: "This lesson has bookings, so it was hidden instead of deleted." });
  }
  await query("delete from lesson_types where id = $1", [id]);
  refreshPublic();
  back("/admin/lessons", { ok: "Lesson deleted." });
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export async function saveWeeklyHoursAction(fd: FormData) {
  await requireAdmin();
  try {
    const rows: { weekday: number; start: string; end: string }[] = [];
    for (let d = 0; d < 7; d++) {
      if (fd.get(`on_${d}`) !== "on") continue;
      const starts = fd.getAll(`start_${d}`).map(String);
      const ends = fd.getAll(`end_${d}`).map(String);
      starts.forEach((st, i) => {
        const en = ends[i];
        if (!st || !en) return;
        if (!/^\d{2}:\d{2}$/.test(st) || !/^\d{2}:\d{2}$/.test(en)) throw new BookingError("invalid", "Please enter times as HH:MM.");
        if (en <= st) throw new BookingError("invalid", "Each end time must be after its start time.");
        rows.push({ weekday: d, start: st, end: en });
      });
    }
    await tx(async (c) => {
      await c.query("delete from weekly_hours");
      for (const r of rows) await c.query("insert into weekly_hours (weekday, start_time, end_time) values ($1,$2,$3)", [r.weekday, r.start, r.end]);
    });
  } catch (e) {
    back("/admin/availability", { error: errMsg(e) });
  }
  back("/admin/availability", { ok: "Working hours saved." });
}

export async function addExceptionAction(fd: FormData) {
  await requireAdmin();
  const returnTo = str(fd, "return_to").startsWith("/admin") ? str(fd, "return_to") : "/admin/availability";
  try {
    const s = await getSettings();
    const kind = z.enum(["block", "open"]).parse(fd.get("kind"));
    const from = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date.").parse(str(fd, "from_date"));
    const to = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch(from).parse(str(fd, "to_date") || from);
    const allDay = fd.get("all_day") === "on";
    let startsAt: number, endsAt: number;
    if (allDay) {
      startsAt = zonedToEpoch(from, "00:00", s.timezone);
      endsAt = zonedToEpoch(addDaysYmd(to, 1), "00:00", s.timezone);
    } else {
      const ft = z.string().regex(/^\d{2}:\d{2}$/, "Enter a start time.").parse(str(fd, "from_time"));
      const tt = z.string().regex(/^\d{2}:\d{2}$/, "Enter an end time.").parse(str(fd, "to_time"));
      startsAt = zonedToEpoch(from, ft, s.timezone);
      endsAt = zonedToEpoch(to, tt, s.timezone);
    }
    if (endsAt <= startsAt) throw new BookingError("invalid", "The end must be after the start.");
    await query("insert into schedule_exceptions (kind, starts_at, ends_at, note) values ($1,$2,$3,$4)",
      [kind, new Date(startsAt), new Date(endsAt), str(fd, "note").slice(0, 200) || null]);
  } catch (e) {
    back(returnTo, { error: errMsg(e) });
  }
  back(returnTo, { ok: fd.get("kind") === "block" ? "Time blocked out." : "Extra availability added." });
}

export async function deleteExceptionAction(fd: FormData) {
  await requireAdmin();
  const returnTo = str(fd, "return_to").startsWith("/admin") ? str(fd, "return_to") : "/admin/availability";
  await query("delete from schedule_exceptions where id = $1", [z.uuid().parse(fd.get("id"))]);
  back(returnTo, { ok: "Removed." });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function saveReviewAction(fd: FormData) {
  await requireAdmin();
  const id = optStr(fd, "id");
  try {
    const author = z.string().trim().min(1, "Add the student’s name.").max(80).parse(str(fd, "author_name"));
    const body = z.string().trim().min(5, "Add the review text.").max(1200).parse(str(fd, "body"));
    const rating = str(fd, "rating") ? z.coerce.number().int().min(1).max(5).parse(fd.get("rating")) : null;
    const source = str(fd, "source").slice(0, 60) || null;
    const published = fd.get("published") === "on";
    if (id) await query("update reviews set author_name=$2, body=$3, rating=$4, source=$5, published=$6 where id=$1", [id, author, body, rating, source, published]);
    else await query("insert into reviews (author_name, body, rating, source, published) values ($1,$2,$3,$4,$5)", [author, body, rating, source, published]);
  } catch (e) {
    back("/admin/reviews", { error: errMsg(e) });
  }
  refreshPublic();
  back("/admin/reviews", { ok: "Review saved." });
}

export async function deleteReviewAction(fd: FormData) {
  await requireAdmin();
  await query("delete from reviews where id = $1", [z.uuid().parse(fd.get("id"))]);
  refreshPublic();
  back("/admin/reviews", { ok: "Review deleted." });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const url = z.string().trim().max(300).refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), "Links must start with https://");
const optUrlOrPath = z.string().trim().max(500).refine((v) => !v || /^(https:\/\/|\/)[^\s]+$/.test(v), "Use an https:// link or a /images/... path.");

export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
  const section = str(fd, "section");
  try {
    if (section === "business") {
      const d = z.object({
        instructor_name: z.string().trim().max(80),
        years_experience: z.string().trim().refine((v) => !v || /^\d{1,2}$/.test(v), "Years must be a number."),
        instructor_bio: z.string().max(3000),
        instructor_qualifications: z.string().max(1000),
        teaching_approach: z.string().max(1500),
        instructor_photo_url: optUrlOrPath,
        phone: z.string().trim().max(30),
        email: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email."),
        notification_email: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, "Enter a valid notification email."),
        address_line: z.string().trim().max(200),
        locality: z.string().trim().max(100),
        postcode: z.string().trim().max(20),
        service_areas: z.string().trim().max(500),
        instagram_url: url, facebook_url: url, tiktok_url: url,
      }).parse(Object.fromEntries(fd));
      const n = (v: string) => v || null;
      await query(
        `update settings set instructor_name=$1, years_experience=$2, instructor_bio=$3, instructor_qualifications=$4, teaching_approach=$5,
           instructor_photo_url=$6, phone=$7, email=$8, notification_email=$9, address_line=$10, locality=$11, postcode=$12, service_areas=$13,
           instagram_url=$14, facebook_url=$15, tiktok_url=$16, updated_at=now() where id=1`,
        [n(d.instructor_name), d.years_experience ? Number(d.years_experience) : null, n(d.instructor_bio), n(d.instructor_qualifications), n(d.teaching_approach),
         n(d.instructor_photo_url), n(d.phone), n(d.email.toLowerCase()), n(d.notification_email.toLowerCase()), n(d.address_line), n(d.locality), n(d.postcode),
         n(d.service_areas), n(d.instagram_url), n(d.facebook_url), n(d.tiktok_url)],
      );
    } else if (section === "booking") {
      const int = (min: number, max: number, label: string) => z.coerce.number({ error: `${label} must be a number.` }).int().min(min, `${label} is too small.`).max(max, `${label} is too large.`);
      const d = z.object({
        slot_interval_minutes: int(5, 240, "Slot interval"),
        buffer_minutes: int(0, 240, "Buffer"),
        min_notice_hours: int(0, 720, "Minimum notice"),
        max_advance_days: int(1, 365, "Booking window"),
        cancellation_notice_hours: int(0, 720, "Cancellation notice"),
        payment_mode: z.enum(["pay_at_lesson", "deposit", "full"]),
      }).parse(Object.fromEntries(fd));
      const deposit = d.payment_mode === "deposit" ? pounds(str(fd, "deposit")) : 0;
      await query(
        `update settings set slot_interval_minutes=$1, buffer_minutes=$2, min_notice_hours=$3, max_advance_days=$4, cancellation_notice_hours=$5,
           require_approval=$6, payment_mode=$7, deposit_pence=$8, updated_at=now() where id=1`,
        [d.slot_interval_minutes, d.buffer_minutes, d.min_notice_hours, d.max_advance_days, d.cancellation_notice_hours, fd.get("require_approval") === "on", d.payment_mode, deposit],
      );
    } else if (section === "password") {
      const admin = await requireAdmin();
      if (str(fd, "next") !== str(fd, "confirm")) throw new BookingError("invalid", "The new passwords don’t match.");
      const err = await changePassword(admin.id, String(fd.get("current") ?? ""), String(fd.get("next") ?? ""));
      if (err) throw new BookingError("invalid", err);
    }
  } catch (e) {
    back("/admin/settings", { error: errMsg(e) });
  }
  refreshPublic();
  back("/admin/settings", { ok: section === "password" ? "Password changed." : "Settings saved." });
}
