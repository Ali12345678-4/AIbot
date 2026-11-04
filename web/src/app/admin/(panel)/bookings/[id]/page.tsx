import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/server/db";
import { getSettings } from "@/server/settings";
import { bookingAction, editBookingAction } from "@/app/admin/actions";
import { Flash, StatusBadge, PaymentBadge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { fmtTz, formatDuration, formatMoney } from "@/lib/format";
import { experienceLabel, type BookingStatus, type LessonType, type PaymentStatus } from "@/lib/types";

export const metadata = { title: "Booking" };

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await getSettings();
  const b = await queryOne<{
    id: string; reference: string; starts_at: Date; ends_at: Date; lesson_name: string; lesson_type_id: string | null; duration_minutes: number; price_pence: number;
    status: BookingStatus; payment_mode: string; payment_status: PaymentStatus; amount_due_pence: number; experience: string | null; student_message: string | null;
    admin_notes: string; cancel_reason: string | null; cancelled_by: string | null; created_at: Date;
    student_id: string; full_name: string; email: string; phone: string; internal_notes: string;
  }>(
    `select b.*, s.full_name, s.email, s.phone, s.internal_notes from bookings b join students s on s.id = b.student_id where b.id = $1`, [id]);
  if (!b) notFound();
  const [events, lessons, emails] = await Promise.all([
    query<{ actor: string; action: string; created_at: Date; detail: { reason?: string } | null }>("select actor, action, created_at, detail from booking_events where booking_id = $1 order by created_at desc", [id]),
    query<LessonType>("select * from lesson_types order by active desc, sort_order, name"),
    query<{ subject: string; to_address: string; status: string; created_at: Date }>("select subject, to_address, status, created_at from email_log where booking_id = $1 order by created_at desc", [id]),
  ]);
  const active = b.status === "pending" || b.status === "confirmed";
  const past = new Date(b.ends_at) < new Date();
  const tz = s.timezone;

  return (
    <>
      <Link href="/admin/bookings" className="link-arrow mb-6 text-[14px]"><Icon name="alt-arrow-left-linear" size={16} />Bookings</Link>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em]">{b.full_name}</h1>
            <StatusBadge status={b.status} />
          </div>
          <p className="mt-1 text-[15px] text-muted">{fmtTz(b.starts_at, "EEEE d MMMM yyyy", tz)} · {fmtTz(b.starts_at, "HH:mm", tz)}–{fmtTz(b.ends_at, "HH:mm", tz)} · <span className="font-mono text-[13px]">{b.reference}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {b.status === "pending" && (
            <form action={bookingAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="op" value="approve" />
              <SubmitButton className="btn btn-primary" pendingText="Confirming…"><Icon name="check-circle-linear" size={18} />Accept</SubmitButton>
            </form>
          )}
          {b.status === "confirmed" && past && (
            <>
              <form action={bookingAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="op" value="completed" /><SubmitButton className="btn btn-primary">Mark completed</SubmitButton></form>
              <form action={bookingAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="op" value="no_show" /><SubmitButton className="btn btn-ghost">No-show</SubmitButton></form>
            </>
          )}
          {(b.status === "completed" || b.status === "no_show") && (
            <form action={bookingAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="op" value="reopen" /><SubmitButton className="btn btn-ghost">Reopen</SubmitButton></form>
          )}
          <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="btn btn-ghost"><Icon name="phone-linear" size={18} />Call</a>
          <a href={`mailto:${b.email}?subject=${encodeURIComponent(`Your driving lesson ${b.reference}`)}`} className="btn btn-ghost"><Icon name="letter-linear" size={18} />Email</a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="lesson-h">
            <h2 id="lesson-h" className="mb-4 font-semibold">Lesson</h2>
            <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
              <Item k="Lesson" v={`${b.lesson_name} · ${formatDuration(b.duration_minutes)}`} />
              <Item k="Price" v={formatMoney(b.price_pence, s.currency)} />
              <Item k="Payment" v={<><PaymentBadge status={b.payment_status} />{b.payment_mode !== "pay_at_lesson" && b.amount_due_pence > 0 && <span className="text-[13px] text-muted"> · {formatMoney(b.amount_due_pence, s.currency)} online</span>}</>} />
              <Item k="Booked" v={fmtTz(b.created_at, "d MMM yyyy, HH:mm", tz)} />
              {b.cancel_reason && <Item k={b.status === "rejected" ? "Decline reason" : "Cancellation"} v={`${b.cancel_reason}${b.cancelled_by ? ` (${b.cancelled_by})` : ""}`} />}
            </dl>
            {b.payment_mode === "pay_at_lesson" && b.status !== "rejected" && (
              <form action={bookingAction} className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-5">
                <input type="hidden" name="id" value={b.id} /><input type="hidden" name="op" value="payment" />
                <div>
                  <label htmlFor="payment_status" className="field-label">Payment status</label>
                  <select id="payment_status" name="payment_status" defaultValue={b.payment_status === "authorised" ? "unpaid" : b.payment_status} className="field !min-h-[40px] !py-2">
                    <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="not_required">No payment due</option>
                  </select>
                </div>
                <SubmitButton className="btn btn-ghost btn-sm">Update</SubmitButton>
              </form>
            )}
          </section>

          <section className="card p-6" aria-labelledby="student-h">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="student-h" className="font-semibold">Student</h2>
              <Link href={`/admin/students/${b.student_id}`} className="link-arrow text-[14px]">Profile &amp; history <Icon name="alt-arrow-right-linear" size={14} /></Link>
            </div>
            <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
              <Item k="Phone" v={<a className="text-accent" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a>} />
              <Item k="Email" v={<a className="break-all text-accent" href={`mailto:${b.email}`}>{b.email}</a>} />
              <Item k="Experience" v={experienceLabel(b.experience)} />
              {b.student_message && <div className="sm:col-span-2"><Item k="Message from student" v={<span className="whitespace-pre-wrap font-normal">{b.student_message}</span>} /></div>}
              {b.internal_notes && <div className="sm:col-span-2"><Item k="Your notes on this student" v={<span className="whitespace-pre-wrap font-normal">{b.internal_notes}</span>} /></div>}
            </dl>
          </section>

          <section className="card p-6" aria-labelledby="edit-h">
            <h2 id="edit-h" className="mb-1 font-semibold">Edit or reschedule</h2>
            <p className="mb-5 text-[14px] text-muted">You can place lessons outside your normal hours. Overlapping bookings are always prevented.</p>
            <form action={editBookingAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={b.id} />
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="lesson_type_id">Lesson type</label>
                <select id="lesson_type_id" name="lesson_type_id" defaultValue={b.lesson_type_id ?? ""} className="field">
                  <option value="">Custom ({b.lesson_name})</option>
                  {lessons.map((l) => <option key={l.id} value={l.id}>{l.name}{!l.active ? " (hidden)" : ""}</option>)}
                </select>
                <input type="hidden" name="lesson_name" value={b.lesson_name} />
              </div>
              <div><label className="field-label" htmlFor="date">Date</label><input id="date" name="date" type="date" required defaultValue={fmtTz(b.starts_at, "yyyy-MM-dd", tz)} className="field" /></div>
              <div><label className="field-label" htmlFor="time">Start time</label><input id="time" name="time" type="time" step={300} required defaultValue={fmtTz(b.starts_at, "HH:mm", tz)} className="field" /></div>
              <div><label className="field-label" htmlFor="duration">Duration (minutes)</label><input id="duration" name="duration" type="number" min={15} max={600} step={5} required defaultValue={b.duration_minutes} className="field" /></div>
              <div><label className="field-label" htmlFor="price">Price (£)</label><input id="price" name="price" inputMode="decimal" required defaultValue={(b.price_pence / 100).toFixed(2)} className="field" /></div>
              <div className="sm:col-span-2"><label className="field-label" htmlFor="admin_notes">Notes for this lesson (private)</label><textarea id="admin_notes" name="admin_notes" defaultValue={b.admin_notes} className="field" /></div>
              <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--color-accent)]" />Email the student if the date, time or lesson changes</label>
              <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          {active && (
            <section className="card p-6" aria-labelledby="cancel-h">
              <h2 id="cancel-h" className="font-semibold">{b.status === "pending" ? "Decline or cancel" : "Cancel lesson"}</h2>
              <form action={bookingAction} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={b.id} />
                <div>
                  <label className="field-label" htmlFor="reason">Message to student (optional)</label>
                  <textarea id="reason" name="reason" maxLength={500} className="field !min-h-[80px]" placeholder="e.g. I’m unavailable that day — please pick another time." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status === "pending" && <SubmitButton className="btn btn-danger" name="op" value="reject" confirm="Decline this booking request?">Decline request</SubmitButton>}
                  {b.status === "confirmed" && <SubmitButton className="btn btn-danger" name="op" value="cancel" confirm="Cancel this lesson? The student will be emailed.">Cancel lesson</SubmitButton>}
                </div>
                {b.payment_status === "paid" || b.payment_status === "authorised" ? <p className="text-[13px] text-muted">Any online payment will be released or refunded automatically.</p> : null}
              </form>
            </section>
          )}

          <section className="card p-6" aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-4 font-semibold">History</h2>
            <ol className="space-y-3 text-[14px]">
              {events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                  <span><span className="font-medium capitalize">{e.action.replace(/_/g, " ")}</span> <span className="text-muted">by {e.actor} · {fmtTz(e.created_at, "d MMM, HH:mm", tz)}</span>{e.detail?.reason && <span className="block text-muted">“{e.detail.reason}”</span>}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-6" aria-labelledby="mail-h">
            <h2 id="mail-h" className="mb-4 font-semibold">Emails</h2>
            {emails.length ? (
              <ul className="space-y-3 text-[14px]">
                {emails.map((m, i) => (
                  <li key={i}><span className="font-medium">{m.subject}</span><span className="block text-muted">to {m.to_address} · {fmtTz(m.created_at, "d MMM, HH:mm", tz)} · {m.status === "logged" ? "not sent (no provider)" : m.status}</span></li>
                ))}
              </ul>
            ) : <p className="text-[14px] text-muted">No emails yet.</p>}
          </section>
        </div>
      </div>
    </>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-[13px] text-muted">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>;
}
