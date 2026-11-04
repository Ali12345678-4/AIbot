import Link from "next/link";
import type { Metadata } from "next";
import { SimpleShell } from "@/components/site/SimpleShell";
import { confirmCheckout } from "@/server/bookings";
import { getSettings } from "@/server/settings";
import { Icon } from "@/components/Icon";
import { fmtDateLong, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking complete", robots: { index: false } };

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const settings = await getSettings();
  let b: Awaited<ReturnType<typeof confirmCheckout>> = null;
  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try { b = await confirmCheckout(session_id); } catch (e) { console.error(e); }
  }
  return (
    <SimpleShell narrow>
      <div className="mx-auto max-w-xl text-center">
        {b ? (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-ok-soft text-ok"><Icon name="check-circle-bold" size={36} /></div>
            <h1 className="mt-6 font-display text-[2.5rem] font-bold tracking-[-0.03em]">{b.status === "confirmed" ? "You’re booked in." : "Request received."}</h1>
            <p className="mt-3 text-lg text-ink-2">{b.lesson_name} on {fmtDateLong(b.starts_at, settings.timezone)} at {fmtTime(b.starts_at, settings.timezone)}.</p>
            <p className="mt-2 text-muted">Reference <strong className="text-ink">{b.reference}</strong>. We’ve emailed you the details and a link to manage your booking.</p>
          </>
        ) : (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-warn-soft text-warn"><Icon name="clock-circle-linear" size={32} /></div>
            <h1 className="mt-6 font-display text-[2.25rem] font-bold tracking-[-0.03em]">We’re confirming your payment.</h1>
            <p className="mt-3 text-ink-2">This can take a moment. You’ll receive an email once it’s done. If you don’t, please get in touch{settings.phone ? ` on ${settings.phone}` : ""}.</p>
          </>
        )}
        <Link href="/" className="btn btn-primary mt-10">Back to home</Link>
      </div>
    </SimpleShell>
  );
}
