import Link from "next/link";
import { query } from "@/server/db";
import { getSettings } from "@/server/settings";
import { saveWeeklyHoursAction, deleteExceptionAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { WeeklyHoursEditor } from "@/components/admin/WeeklyHoursEditor";
import { Icon } from "@/components/Icon";
import { fmtTz } from "@/lib/format";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const [weekly, upcoming] = await Promise.all([
    query<{ weekday: number; start_time: string; end_time: string }>("select weekday, start_time::text, end_time::text from weekly_hours order by weekday, start_time"),
    query<{ id: string; kind: string; starts_at: Date; ends_at: Date; note: string | null }>("select id, kind, starts_at, ends_at, note from schedule_exceptions where ends_at > now() order by starts_at limit 50"),
  ]);
  return (
    <>
      <PageHeader title="Availability" sub={`Your regular working week. Times are in ${s.timezone.replace("_", " ")}.`} actions={<Link href="/admin/calendar" className="btn btn-ghost btn-sm"><Icon name="calendar-mark-linear" size={18} />Block out time</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <form action={saveWeeklyHoursAction} className="card p-6">
          <h2 className="font-semibold">Weekly hours</h2>
          <p className="mt-1 text-[14px] text-muted">Students can only book inside these hours. Lessons must fit completely within a range.</p>
          <div className="mt-4"><WeeklyHoursEditor initial={weekly} /></div>
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
            <p className="text-[13px] text-muted">Booking rules (notice, buffer, slot interval) are in <Link href="/admin/settings#booking" className="text-accent underline">Settings</Link>.</p>
            <SubmitButton>Save hours</SubmitButton>
          </div>
        </form>
        <section className="card p-6">
          <h2 className="font-semibold">Upcoming time off &amp; extra hours</h2>
          {upcoming.length ? (
            <ul className="mt-4 divide-y divide-line">
              {upcoming.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-3 text-[14px]">
                  <span><span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.kind === "block" ? "bg-mist text-ink-2" : "bg-accent-soft text-accent-ink"}`}>{x.kind === "block" ? "Blocked" : "Extra"}</span>{fmtTz(x.starts_at, "EEE d MMM HH:mm", s.timezone)} – {fmtTz(x.ends_at, "EEE d MMM HH:mm", s.timezone)}{x.note && <span className="text-muted"> · {x.note}</span>}</span>
                  <form action={deleteExceptionAction}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="return_to" value="/admin/availability" />
                    <SubmitButton className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" pendingText="" confirm="Remove this?"><Icon name="trash-bin-trash-linear" size={18} label="Remove" /></SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[14px] text-muted">None. Add holidays and appointments from the <Link href="/admin/calendar" className="text-accent underline">calendar</Link>.</p>}
        </section>
      </div>
    </>
  );
}
