import type { Metadata } from "next";
import { SimpleShell } from "@/components/site/SimpleShell";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { getActiveLessonTypes, getSettings } from "@/server/settings";
import { effectivePaymentMode } from "@/server/bookings";
import { addDaysYmd, todayInTz } from "@/lib/availability";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a Driving Lesson Online",
  description: "Choose a lesson, see live availability and book your driving lesson online in minutes. No account needed.",
  alternates: { canonical: "/book" },
};

export default async function BookPage({ searchParams }: { searchParams: Promise<{ lesson?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const [settings, lessons] = await Promise.all([getSettings(), getActiveLessonTypes()]);
  const today = todayInTz(settings.timezone);
  return (
    <SimpleShell>
      <BookingFlow
        lessons={lessons}
        initialLessonSlug={sp.lesson}
        currency={settings.currency}
        timezone={settings.timezone}
        requireApproval={settings.require_approval}
        paymentMode={effectivePaymentMode(settings)}
        depositPence={settings.deposit_pence}
        cancellationHours={settings.cancellation_notice_hours}
        today={today}
        lastDate={addDaysYmd(today, settings.max_advance_days)}
        contactPhone={settings.phone}
        cancelledRef={sp.cancelled}
      />
    </SimpleShell>
  );
}
