import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/server/db";
import { getSettings } from "@/server/settings";
import { updateStudentAction } from "@/app/admin/actions";
import { Flash, StatusBadge, PaymentBadge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { fmtTz, formatMoney } from "@/lib/format";
import { experienceLabel, type BookingStatus, type PaymentStatus } from "@/lib/types";

export const metadata = { title: "Student" };

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await getSettings();
  const st = await queryOne<{ id: string; full_name: string; email: string; phone: string; experience: string | null; internal_notes: string; created_at: Date }>("select * from students where id = $1", [id]);
  if (!st) notFound();
  const bookings = await query<{ id: string; reference: string; starts_at: Date; lesson_name: string; status: BookingStatus; price_pence: number; payment_status: PaymentStatus }>(
    "select id, reference, starts_at, lesson_name, status, price_pence, payment_status from bookings where student_id = $1 order by starts_at desc", [id]);
  const done = bookings.filter((b) => b.status === "completed" || (b.status === "confirmed" && new Date(b.starts_at) < new Date()));
  return (
    <>
      <Link href="/admin/students" className="link-arrow mb-6 text-[14px]"><Icon name="alt-arrow-left-linear" size={16} />Students</Link>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-8">
        <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em]">{st.full_name}</h1>
        <p className="mt-1 text-[15px] text-muted">{experienceLabel(st.experience)} · Student since {fmtTz(st.created_at, "MMMM yyyy", s.timezone)} · {done.length} lessons taken</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <form action={updateStudentAction} className="card space-y-4 p-6">
          <input type="hidden" name="id" value={st.id} />
          <h2 className="font-semibold">Details &amp; notes</h2>
          <div><label className="field-label" htmlFor="full_name">Name</label><input id="full_name" name="full_name" required defaultValue={st.full_name} className="field" /></div>
          <div><label className="field-label" htmlFor="email">Email</label><input id="email" name="email" type="email" required defaultValue={st.email} className="field" /></div>
          <div><label className="field-label" htmlFor="phone">Phone</label><input id="phone" name="phone" required defaultValue={st.phone} className="field" /></div>
          <div>
            <label className="field-label" htmlFor="internal_notes">Private notes</label>
            <textarea id="internal_notes" name="internal_notes" defaultValue={st.internal_notes} className="field !min-h-[160px]" placeholder="Progress, strengths, things to work on, test date…" />
            <p className="field-hint">Only you can see these.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton>Save</SubmitButton>
            <a href={`tel:${st.phone.replace(/[^\d+]/g, "")}`} className="btn btn-ghost"><Icon name="phone-linear" size={18} />Call</a>
            <Link href={`/admin/bookings/new`} className="btn btn-ghost"><Icon name="add-circle-linear" size={18} />Book</Link>
          </div>
        </form>
        <section className="card overflow-hidden">
          <h2 className="border-b border-line p-6 pb-4 font-semibold">Booking history</h2>
          {bookings.length ? (
            <ul className="divide-y divide-line">
              {bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 transition hover:bg-mist/50">
                    <span className="w-40 text-[14px] font-medium tabular-nums">{fmtTz(b.starts_at, "d MMM yyyy · HH:mm", s.timezone)}</span>
                    <span className="flex-1 text-[14px] text-muted">{b.lesson_name}</span>
                    <span className="text-right text-[13px]">{formatMoney(b.price_pence, s.currency)} · <PaymentBadge status={b.payment_status} /></span>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="p-6 text-muted">No bookings.</p>}
        </section>
      </div>
    </>
  );
}
