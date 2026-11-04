import type { Metadata } from "next";
import { SimpleShell } from "@/components/site/SimpleShell";
import { getSettings } from "@/server/settings";
import { formatMoney } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Terms & Cancellation Policy", alternates: { canonical: "/terms" } };

export default async function TermsPage() {
  const s = await getSettings();
  const contact = [s.phone, s.email].filter(Boolean).join(" or ");
  return (
    <SimpleShell narrow>
      <article className="prose-k4">
        <p className="eyebrow">Legal</p>
        <h1 className="display-md mt-2">Terms &amp; cancellation policy</h1>
        <h2>Booking</h2>
        <p>
          {s.require_approval
            ? "When you book online your chosen time is reserved and sent to the instructor for approval. Your lesson is confirmed when you receive a confirmation email."
            : "When you book online your lesson is confirmed immediately and you will receive a confirmation email."}
        </p>
        <h2>Payment</h2>
        <p>
          {s.payment_mode === "pay_at_lesson" && "Payment is due at the lesson."}
          {s.payment_mode === "full" && "The full lesson price is paid securely online when you book. Where approval is required, your card is authorised at booking and only charged once your lesson is confirmed."}
          {s.payment_mode === "deposit" && `A deposit of ${formatMoney(s.deposit_pence, s.currency)} is paid online when you book, with the balance due at the lesson.`}
        </p>
        <h2>Cancelling or rescheduling</h2>
        <p>You can cancel free of charge up to {s.cancellation_notice_hours} hours before your lesson using the link in your confirmation email. Any online payment for a lesson cancelled within this window is refunded in full.</p>
        <p>To reschedule, please get in touch{contact ? ` (${contact})` : ""} and your lesson will be moved to a suitable time.</p>
        <p>For cancellations with less than {s.cancellation_notice_hours} hours’ notice, please contact the instructor directly.</p>
        <h2>If we need to cancel</h2>
        <p>Occasionally a lesson may need to be cancelled, for example due to illness, vehicle problems or unsafe weather. If this happens we will let you know as soon as possible and refund any payment in full, or rearrange at no extra cost.</p>
        <h2>On the day</h2>
        <p>Please bring your provisional or full licence to every lesson and make sure you are fit to drive. The instructor may end a lesson early if it is unsafe to continue.</p>
      </article>
    </SimpleShell>
  );
}
