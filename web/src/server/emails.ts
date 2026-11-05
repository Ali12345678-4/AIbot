import "server-only";
import { sendEmail } from "./email";
import { fmtDateLong, fmtTime, formatDuration, formatMoney } from "@/lib/format";
import { experienceLabel, type Settings } from "@/lib/types";
import { siteUrl } from "@/lib/site";

export interface BookingEmailData {
  id: string;
  reference: string;
  lesson_name: string;
  duration_minutes: number;
  price_pence: number;
  starts_at: Date;
  status: string;
  payment_mode: string;
  payment_status: string;
  amount_due_pence: number;
  student_name: string;
  student_email: string;
  student_phone: string;
  experience: string | null;
  student_message: string | null;
}

type Kind = "received" | "confirmed" | "rejected" | "cancelled_by_admin" | "cancelled_by_student" | "updated";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, intro: string, rows: [string, string][], footer: string[], cta?: { label: string; url: string }) {
  const text = [title, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []), ...footer].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:18px;padding:40px 32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6e6e73;font-weight:600">K444AXN Driving School</td></tr>
<tr><td style="padding-top:12px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.02em">${esc(title)}</td></tr>
<tr><td style="padding-top:12px;font-size:16px;line-height:1.5;color:#424245">${esc(intro)}</td></tr>
<tr><td style="padding-top:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e8ed">
${rows.map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e8e8ed;color:#6e6e73;font-size:14px;width:40%">${esc(k)}</td><td style="padding:12px 0;border-bottom:1px solid #e8e8ed;font-size:14px;font-weight:600">${esc(v)}</td></tr>`).join("")}
</table></td></tr>
${cta ? `<tr><td style="padding-top:28px"><a href="${esc(cta.url)}" style="display:inline-block;background:#d70f2b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding-top:28px;font-size:13px;line-height:1.6;color:#6e6e73">${footer.map(esc).join("<br>")}</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

function contactLine(s: Settings) {
  const bits = [s.phone && `call ${s.phone}`, s.email && `email ${s.email}`].filter(Boolean);
  return bits.length ? `To reschedule, ${bits.join(" or ")}.` : "To reschedule, reply to this email.";
}

function paymentLine(b: BookingEmailData, s: Settings) {
  if (b.payment_mode === "pay_at_lesson") return `${formatMoney(b.price_pence, s.currency)}, payable at the lesson`;
  const what = b.payment_mode === "deposit" ? "deposit" : "payment";
  if (b.payment_status === "authorised") return `${formatMoney(b.amount_due_pence, s.currency)} ${what} authorised. You are only charged once the lesson is confirmed.`;
  if (b.payment_status === "paid") return `${formatMoney(b.amount_due_pence, s.currency)} ${what} paid`;
  if (b.payment_status === "refunded") return `${formatMoney(b.amount_due_pence, s.currency)} refunded`;
  return formatMoney(b.price_pence, s.currency);
}

export async function sendBookingEmails(kind: Kind, b: BookingEmailData, s: Settings, opts: { manageToken?: string; reason?: string } = {}) {
  const tz = s.timezone;
  const when = `${fmtDateLong(b.starts_at, tz)} at ${fmtTime(b.starts_at, tz)}`;
  const manageUrl = opts.manageToken ? `${siteUrl()}/booking/manage/${opts.manageToken}` : undefined;
  const lessonRows: [string, string][] = [
    ["Reference", b.reference],
    ["Lesson", b.lesson_name],
    ["Date", fmtDateLong(b.starts_at, tz)],
    ["Time", fmtTime(b.starts_at, tz)],
    ["Duration", formatDuration(b.duration_minutes)],
    ["Price", paymentLine(b, s)],
  ];
  const policy = `Free cancellation up to ${s.cancellation_notice_hours} hours before your lesson using your booking link.`;
  const footer = [policy, contactLine(s)];

  const studentMail: Record<Kind, { subject: string; title: string; intro: string } | null> = {
    received: s.require_approval
      ? { subject: `Booking request received – ${b.reference}`, title: "We’ve received your request.", intro: `Thanks, ${b.student_name.split(" ")[0]}. Your lesson on ${when} is reserved while the instructor reviews it. You’ll get another email as soon as it’s confirmed.` }
      : { subject: `Lesson confirmed – ${b.reference}`, title: "You’re booked in.", intro: `Thanks, ${b.student_name.split(" ")[0]}. Your lesson on ${when} is confirmed.` },
    confirmed: { subject: `Lesson confirmed – ${b.reference}`, title: "Your lesson is confirmed.", intro: `Great news — your lesson on ${when} is confirmed. See you then.` },
    rejected: { subject: `Booking update – ${b.reference}`, title: "We couldn’t confirm this lesson.", intro: `Sorry, the lesson requested for ${when} can’t go ahead.${opts.reason ? ` ${opts.reason}` : ""} Any payment hold has been released. Please choose another time.` },
    cancelled_by_admin: { subject: `Lesson cancelled – ${b.reference}`, title: "Your lesson has been cancelled.", intro: `Your lesson on ${when} has been cancelled by the instructor.${opts.reason ? ` Reason: ${opts.reason}` : ""} Any payment will be refunded.` },
    cancelled_by_student: { subject: `Cancellation confirmed – ${b.reference}`, title: "Your lesson is cancelled.", intro: `Your lesson on ${when} has been cancelled as requested.` },
    updated: { subject: `Lesson updated – ${b.reference}`, title: "Your lesson has changed.", intro: `Your booking has been updated. The new details are below.` },
  };

  const m = studentMail[kind];
  if (m) {
    const showCta = manageUrl && !["rejected", "cancelled_by_admin", "cancelled_by_student"].includes(kind);
    const rebook = ["rejected", "cancelled_by_admin", "cancelled_by_student"].includes(kind);
    const { text, html } = layout(m.title, m.intro, lessonRows, footer, showCta ? { label: "Manage booking", url: manageUrl! } : rebook ? { label: "Book another time", url: `${siteUrl()}/book` } : undefined);
    await sendEmail({ to: b.student_email, subject: m.subject, text, html, replyTo: s.email ?? undefined, bookingId: b.id });
  }

  const instructorTo = s.notification_email || s.email;
  const instructorSubjects: Partial<Record<Kind, string>> = {
    received: `${s.require_approval ? "New booking request" : "New booking"}: ${b.student_name}, ${when}`,
    cancelled_by_student: `Cancelled by student: ${b.student_name}, ${when}`,
  };
  const subj = instructorSubjects[kind];
  if (instructorTo && subj) {
    const rows: [string, string][] = [
      ...lessonRows,
      ["Student", b.student_name],
      ["Phone", b.student_phone],
      ["Email", b.student_email],
      ["Experience", experienceLabel(b.experience)],
      ["Notes", b.student_message || "—"],
    ];
    const { text, html } = layout(
      subj.split(":")[0] + ".",
      kind === "received" && s.require_approval ? "This request is waiting for you to accept or decline it." : "Details below.",
      rows,
      ["Sent by your booking system."],
      { label: "Open in dashboard", url: `${siteUrl()}/admin/bookings/${b.id}` },
    );
    await sendEmail({ to: instructorTo, subject: subj, text, html, replyTo: b.student_email, bookingId: b.id });
  }
}
