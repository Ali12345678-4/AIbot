import { getSettings } from "@/server/settings";
import { saveSettingsAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { paymentsAvailable } from "@/server/payments";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Settings" };

function F({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div><label className="field-label" htmlFor={id}>{label}</label>{children}{hint && <p className="field-hint">{hint}</p>}</div>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const stripe = paymentsAvailable();
  return (
    <>
      <PageHeader title="Settings" sub="Your business details and booking rules." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="space-y-8">
        <form action={saveSettingsAction} className="card p-6" id="business">
          <input type="hidden" name="section" value="business" />
          <h2 className="font-semibold">About you &amp; your business</h2>
          <p className="mt-1 text-[14px] text-muted">Shown on your website and in emails. Leave anything blank to hide it.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <F id="instructor_name" label="Your name"><input id="instructor_name" name="instructor_name" defaultValue={s.instructor_name ?? ""} className="field" /></F>
            <F id="years_experience" label="Years teaching"><input id="years_experience" name="years_experience" inputMode="numeric" defaultValue={s.years_experience ?? ""} className="field" /></F>
            <div className="md:col-span-2"><F id="instructor_bio" label="About you" hint="A few short paragraphs. Use new lines to separate them."><textarea id="instructor_bio" name="instructor_bio" defaultValue={s.instructor_bio ?? ""} className="field !min-h-[140px]" /></F></div>
            <F id="instructor_qualifications" label="Qualifications" hint="One per line, e.g. DVSA Approved Driving Instructor (ADI)."><textarea id="instructor_qualifications" name="instructor_qualifications" defaultValue={s.instructor_qualifications ?? ""} className="field" /></F>
            <F id="teaching_approach" label="Teaching approach"><textarea id="teaching_approach" name="teaching_approach" defaultValue={s.teaching_approach ?? ""} className="field" /></F>
            <div className="md:col-span-2"><F id="instructor_photo_url" label="Photo" hint="An https:// image link, or a file placed in /public/images (e.g. /images/instructor.jpg)."><input id="instructor_photo_url" name="instructor_photo_url" defaultValue={s.instructor_photo_url ?? ""} className="field" /></F></div>
            <F id="phone" label="Public phone number"><input id="phone" name="phone" type="tel" defaultValue={s.phone ?? ""} className="field" /></F>
            <F id="email" label="Public email"><input id="email" name="email" type="email" defaultValue={s.email ?? ""} className="field" /></F>
            <div className="md:col-span-2"><F id="notification_email" label="Send booking notifications to" hint="Defaults to your public email."><input id="notification_email" name="notification_email" type="email" defaultValue={s.notification_email ?? ""} className="field" /></F></div>
            <F id="address_line" label="Street address (optional)" hint="Only if you have a public address. Leave blank for a service-area business."><input id="address_line" name="address_line" defaultValue={s.address_line ?? ""} className="field" /></F>
            <div className="grid grid-cols-2 gap-5">
              <F id="locality" label="Town / city"><input id="locality" name="locality" defaultValue={s.locality ?? ""} className="field" /></F>
              <F id="postcode" label="Postcode"><input id="postcode" name="postcode" defaultValue={s.postcode ?? ""} className="field" /></F>
            </div>
            <div className="md:col-span-2"><F id="service_areas" label="Areas covered" hint="Comma separated. Helps local search."><input id="service_areas" name="service_areas" defaultValue={s.service_areas ?? ""} className="field" /></F></div>
            <F id="instagram_url" label="Instagram link"><input id="instagram_url" name="instagram_url" defaultValue={s.instagram_url ?? ""} placeholder="https://instagram.com/…" className="field" /></F>
            <F id="facebook_url" label="Facebook link"><input id="facebook_url" name="facebook_url" defaultValue={s.facebook_url ?? ""} placeholder="https://facebook.com/…" className="field" /></F>
            <F id="tiktok_url" label="TikTok link"><input id="tiktok_url" name="tiktok_url" defaultValue={s.tiktok_url ?? ""} placeholder="https://tiktok.com/@…" className="field" /></F>
          </div>
          <div className="mt-6 border-t border-line pt-5"><SubmitButton>Save details</SubmitButton></div>
        </form>

        <form action={saveSettingsAction} className="card p-6" id="booking">
          <input type="hidden" name="section" value="booking" />
          <h2 className="font-semibold">Booking rules</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <F id="min_notice_hours" label="Minimum notice (hours)" hint="How soon before a lesson students can book."><input id="min_notice_hours" name="min_notice_hours" type="number" min={0} max={720} defaultValue={s.min_notice_hours} className="field" /></F>
            <F id="max_advance_days" label="Booking window (days)" hint="How far ahead students can book."><input id="max_advance_days" name="max_advance_days" type="number" min={1} max={365} defaultValue={s.max_advance_days} className="field" /></F>
            <F id="cancellation_notice_hours" label="Free cancellation (hours)" hint="Students can cancel online until this many hours before."><input id="cancellation_notice_hours" name="cancellation_notice_hours" type="number" min={0} max={720} defaultValue={s.cancellation_notice_hours} className="field" /></F>
            <F id="slot_interval_minutes" label="Start times every (minutes)" hint="e.g. 30 → 9:00, 9:30, 10:00…"><input id="slot_interval_minutes" name="slot_interval_minutes" type="number" min={5} max={240} step={5} defaultValue={s.slot_interval_minutes} className="field" /></F>
            <F id="buffer_minutes" label="Gap between lessons (minutes)" hint="Travel or break time."><input id="buffer_minutes" name="buffer_minutes" type="number" min={0} max={240} step={5} defaultValue={s.buffer_minutes} className="field" /></F>
            <div className="flex items-start pt-8">
              <label className="flex items-start gap-3 text-[15px]"><input type="checkbox" name="require_approval" defaultChecked={s.require_approval} className="mt-0.5 size-5 accent-[var(--color-accent)]" /><span><span className="font-semibold">Approve each booking</span><span className="block text-[13px] text-muted">Requests stay pending until you accept them.</span></span></label>
            </div>
          </div>
          <fieldset className="mt-8 border-t border-line pt-6">
            <legend className="font-semibold">Payment</legend>
            {!stripe && (
              <p className="mt-2 flex gap-2 rounded-xl bg-mist px-4 py-3 text-[14px] text-ink-2"><Icon name="info-circle-linear" size={18} className="mt-0.5 shrink-0" />Online payments need a Stripe account to be connected (see README). Until then, students pay at the lesson whatever you choose here.</p>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {([["pay_at_lesson", "Pay at the lesson", "No online payment."], ["deposit", "Deposit online", "Balance paid at the lesson."], ["full", "Full payment online", "Card authorised at booking, charged when you accept."]] as const).map(([v, t, d]) => (
                <label key={v} className="flex cursor-pointer items-start gap-3 rounded-2xl p-4 shadow-[0_0_0_1px_var(--color-line-strong)] has-[:checked]:shadow-[0_0_0_2px_var(--color-accent)]">
                  <input type="radio" name="payment_mode" value={v} defaultChecked={s.payment_mode === v} className="mt-1 accent-[var(--color-accent)]" />
                  <span><span className="font-semibold">{t}</span><span className="block text-[13px] text-muted">{d}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-4 max-w-xs"><F id="deposit" label="Deposit amount (£)" hint="Used when “Deposit online” is selected."><input id="deposit" name="deposit" inputMode="decimal" defaultValue={(s.deposit_pence / 100).toFixed(2)} className="field" /></F></div>
          </fieldset>
          <div className="mt-6 border-t border-line pt-5"><SubmitButton>Save rules</SubmitButton></div>
        </form>

        <form action={saveSettingsAction} className="card max-w-xl p-6" id="password">
          <input type="hidden" name="section" value="password" />
          <h2 className="font-semibold">Change password</h2>
          <div className="mt-5 space-y-4">
            <F id="current" label="Current password"><input id="current" name="current" type="password" autoComplete="current-password" required className="field" /></F>
            <F id="next" label="New password" hint="At least 10 characters."><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className="field" /></F>
            <F id="confirm" label="Confirm new password"><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="field" /></F>
          </div>
          <div className="mt-6"><SubmitButton>Change password</SubmitButton></div>
        </form>
      </div>
    </>
  );
}
