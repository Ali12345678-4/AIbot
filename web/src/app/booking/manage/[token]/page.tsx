import Link from "next/link";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SimpleShell } from "@/components/site/SimpleShell";
import { BookingError, bookingByToken, canStudentCancel, studentCancel } from "@/server/bookings";
import { getSettings } from "@/server/settings";
import { fmtDateLong, fmtTime, formatDuration, formatMoney } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage your booking", robots: { index: false, follow: false } };

export default async function ManagePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; done?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const [b, s] = await Promise.all([bookingByToken(token), getSettings()]);

  async function cancel() {
    "use server";
    try {
      await studentCancel(token);
    } catch (e) {
      const msg = e instanceof BookingError ? e.message : "Something went wrong. Please contact us.";
      redirect(`/booking/manage/${token}?error=${encodeURIComponent(msg)}`);
    }
    revalidatePath(`/booking/manage/${token}`);
    redirect(`/booking/manage/${token}?done=1`);
  }

  if (!b) {
    return (
      <SimpleShell narrow>
        <h1 className="display-md">Booking not found.</h1>
        <p className="lede mt-4">This link may have expired or been replaced by a newer one. Please use the most recent email we sent you{s.phone ? `, or call ${s.phone}` : ""}.</p>
        <Link href="/book" className="btn btn-primary mt-8">Make a new booking</Link>
      </SimpleShell>
    );
  }

  const active = b.status === "pending" || b.status === "confirmed";
  const cancellable = active && canStudentCancel(new Date(b.starts_at), s);
  const contact = [s.phone && `call ${s.phone}`, s.email && `email ${s.email}`].filter(Boolean).join(" or ");

  return (
    <SimpleShell narrow>
      <p className="eyebrow">Booking {b.reference}</p>
      <h1 className="display-md mt-2">Hi {b.student_name.split(" ")[0]}, here’s your lesson.</h1>
      {sp.done && <p role="status" className="mt-6 rounded-2xl bg-ok-soft px-5 py-4 text-ok">Your lesson has been cancelled. A confirmation email is on its way.</p>}
      {sp.error && <p role="alert" className="mt-6 rounded-2xl bg-danger-soft px-5 py-4 text-danger">{sp.error}</p>}
      <dl className="card mt-8 divide-y divide-line">
        {[
          ["Status", STATUS_LABEL[b.status]],
          ["Lesson", `${b.lesson_name} · ${formatDuration(b.duration_minutes)}`],
          ["Date", fmtDateLong(b.starts_at, s.timezone)],
          ["Time", fmtTime(b.starts_at, s.timezone)],
          ["Price", formatMoney(b.price_pence, s.currency)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6 px-6 py-4"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
        ))}
      </dl>

      {active && (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="font-semibold">Need to reschedule?</h2>
            <p className="mt-2 text-[15px] text-muted">{contact ? `Please ${contact} and your lesson will be moved for you.` : "Cancel below and book a new time."}</p>
          </div>
          <div className="card p-6">
            <h2 className="font-semibold">Cancel this lesson</h2>
            {cancellable ? (
              <form action={cancel} className="mt-4">
                <p className="mb-4 text-[15px] text-muted">Free cancellation is available until {s.cancellation_notice_hours} hours before your lesson.</p>
                <SubmitButton className="btn btn-danger" pendingText="Cancelling…" confirm="Cancel this lesson? This can’t be undone.">Cancel lesson</SubmitButton>
              </form>
            ) : (
              <p className="mt-2 text-[15px] text-muted">Online cancellation closes {s.cancellation_notice_hours} hours before the lesson.{contact ? ` Please ${contact}.` : ""}</p>
            )}
          </div>
        </div>
      )}
      {!active && <Link href="/book" className="btn btn-primary mt-10">Book another lesson</Link>}
    </SimpleShell>
  );
}
