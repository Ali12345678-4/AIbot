import Link from "next/link";
import { query } from "@/server/db";
import { createManualBookingAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { formatDuration, formatMoney } from "@/lib/format";
import type { LessonType } from "@/lib/types";

export const metadata = { title: "New booking" };

export default async function NewBooking({ searchParams }: { searchParams: Promise<{ error?: string; date?: string; time?: string }> }) {
  const sp = await searchParams;
  const lessons = await query<LessonType>("select * from lesson_types order by active desc, sort_order, name");
  return (
    <>
      <Link href="/admin/bookings" className="link-arrow mb-6 text-[14px]"><Icon name="alt-arrow-left-linear" size={16} />Bookings</Link>
      <PageHeader title="New booking" sub="Add a lesson booked by phone or in person. It’s confirmed straight away." />
      <Flash error={sp.error} />
      {lessons.length === 0 ? (
        <p className="card p-6">Create a <Link className="text-accent underline" href="/admin/lessons">lesson type</Link> first.</p>
      ) : (
        <form action={createManualBookingAction} className="card grid max-w-2xl gap-5 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="field-label" htmlFor="fullName">Student name</label><input id="fullName" name="fullName" required className="field" autoComplete="off" /></div>
          <div><label className="field-label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required className="field" /></div>
          <div><label className="field-label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="field" /></div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="lessonTypeId">Lesson</label>
            <select id="lessonTypeId" name="lessonTypeId" required className="field">
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.name} · {formatDuration(l.duration_minutes)} · {formatMoney(l.price_pence)}</option>)}
            </select>
          </div>
          <div><label className="field-label" htmlFor="date">Date</label><input id="date" name="date" type="date" required defaultValue={sp.date} className="field" /></div>
          <div><label className="field-label" htmlFor="time">Start time</label><input id="time" name="time" type="time" step={300} required defaultValue={sp.time} className="field" /></div>
          <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--color-accent)]" />Email a confirmation to the student</label>
          <div className="sm:col-span-2"><SubmitButton pendingText="Creating…">Create booking</SubmitButton></div>
        </form>
      )}
    </>
  );
}
