import Link from "next/link";
import { query, queryOne } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageHeader, Stat, StatusBadge, Empty } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { fmtTz, formatMoney } from "@/lib/format";
import { todayInTz, zonedToEpoch, addDaysYmd } from "@/lib/availability";
import { emailConfigured } from "@/server/email";
import { paymentsAvailable } from "@/server/payments";
import type { BookingStatus } from "@/lib/types";

export const metadata = { title: "Overview" };

interface Row { id: string; reference: string; starts_at: Date; lesson_name: string; status: BookingStatus; full_name: string; phone: string; duration_minutes: number }

const SELECT = `select b.id, b.reference, b.starts_at, b.lesson_name, b.status, b.duration_minutes, s.full_name, s.phone
  from bookings b join students s on s.id = b.student_id`;

export default async function Overview() {
  const s = await getSettings();
  const today = todayInTz(s.timezone);
  const dayStart = new Date(zonedToEpoch(today, "00:00", s.timezone));
  const dayEnd = new Date(zonedToEpoch(addDaysYmd(today, 1), "00:00", s.timezone));
  const weekEnd = new Date(zonedToEpoch(addDaysYmd(today, 7), "00:00", s.timezone));

  const [todays, pending, upcoming, totals, lessons, hours] = await Promise.all([
    query<Row>(`${SELECT} where b.starts_at >= $1 and b.starts_at < $2 and b.status in ('pending','confirmed','completed','no_show') order by b.starts_at`, [dayStart, dayEnd]),
    query<Row>(`${SELECT} where b.status = 'pending' and b.starts_at > now() order by b.starts_at limit 20`),
    query<Row>(`${SELECT} where b.starts_at >= $1 and b.status in ('pending','confirmed') order by b.starts_at limit 8`, [dayEnd]),
    queryOne<{ total: number; week: number; revenue: number; students: number }>(
      `select (select count(*)::int from bookings where status not in ('rejected','cancelled')) total,
              (select count(*)::int from bookings where status in ('pending','confirmed') and starts_at >= $1 and starts_at < $2) week,
              (select coalesce(sum(price_pence),0)::int from bookings where status in ('confirmed','completed') and starts_at >= date_trunc('month', now()) and starts_at < date_trunc('month', now()) + interval '1 month') revenue,
              (select count(*)::int from students) students`, [dayStart, weekEnd]),
    queryOne<{ n: number }>("select count(*)::int n from lesson_types where active"),
    queryOne<{ n: number }>("select count(*)::int n from weekly_hours"),
  ]);

  const setup = [
    { done: (lessons?.n ?? 0) > 0, label: "Add your lesson types and prices", href: "/admin/lessons" },
    { done: (hours?.n ?? 0) > 0, label: "Set your weekly working hours", href: "/admin/availability" },
    { done: Boolean(s.phone || s.email), label: "Add your contact details", href: "/admin/settings" },
    { done: Boolean(s.instructor_name), label: "Introduce yourself (name, bio, qualifications)", href: "/admin/settings" },
    { done: emailConfigured(), label: "Connect an email provider so students receive emails", href: "/admin/emails" },
    ...(s.payment_mode !== "pay_at_lesson" ? [{ done: paymentsAvailable(), label: "Connect Stripe to take online payments", href: "/admin/settings" }] : []),
  ];
  const remaining = setup.filter((x) => !x.done);
  const t = (d: Date) => fmtTz(d, "HH:mm", s.timezone);

  return (
    <>
      <PageHeader
        title={`Good ${greeting(s.timezone)}${s.instructor_name ? `, ${s.instructor_name.split(" ")[0]}` : ""}.`}
        sub={fmtTz(new Date(), "EEEE d MMMM", s.timezone)}
        actions={<Link href="/admin/bookings/new" className="btn btn-primary btn-sm"><Icon name="add-circle-linear" size={18} />New booking</Link>}
      />

      {remaining.length > 0 && (
        <section className="card mb-8 p-6" aria-labelledby="setup-title">
          <h2 id="setup-title" className="font-semibold">Finish setting up <span className="text-muted">· {setup.length - remaining.length} of {setup.length} done</span></h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {setup.map((x) => (
              <li key={x.label}>
                <Link href={x.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition hover:bg-mist ${x.done ? "text-muted line-through" : ""}`}>
                  <Icon name={x.done ? "check-circle-bold" : "add-circle-linear"} size={20} className={x.done ? "text-ok" : "text-accent"} />{x.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Today" value={todays.filter((b) => b.status !== "no_show").length} href="/admin/calendar?view=day" />
        <Stat label="Pending requests" value={pending.length} href="/admin/bookings?status=pending" accent={pending.length > 0} />
        <Stat label="Next 7 days" value={totals?.week ?? 0} href="/admin/calendar?view=week" />
        <Stat label="Booked this month" value={formatMoney(totals?.revenue ?? 0, s.currency)} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="today-title">
          <h2 id="today-title" className="mb-3 text-lg font-semibold">Today’s lessons</h2>
          {todays.length ? (
            <ul className="card divide-y divide-line">
              {todays.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-mist/60">
                    <span className="w-14 font-display text-lg font-bold tabular-nums">{t(b.starts_at)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.full_name}</span><span className="block truncate text-[13px] text-muted">{b.lesson_name} · {b.phone}</span></span>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="No lessons today." body="Enjoy the quiet, or check what’s coming up." />}
        </section>

        <section aria-labelledby="pending-title">
          <h2 id="pending-title" className="mb-3 text-lg font-semibold">Waiting for your approval</h2>
          {pending.length ? (
            <ul className="card divide-y divide-line">
              {pending.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-mist/60">
                    <span className="w-24 shrink-0 text-[13px] leading-tight"><span className="block font-semibold">{fmtTz(b.starts_at, "EEE d MMM", s.timezone)}</span><span className="text-muted">{t(b.starts_at)}</span></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.full_name}</span><span className="block truncate text-[13px] text-muted">{b.lesson_name}</span></span>
                    <span className="link-arrow text-[13px]">Review <Icon name="alt-arrow-right-linear" size={14} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="You’re all caught up." body="New booking requests will appear here." />}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="up-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="up-title" className="text-lg font-semibold">Coming up</h2>
          <Link href="/admin/bookings" className="link-arrow text-[14px]">All bookings <Icon name="alt-arrow-right-linear" size={14} /></Link>
        </div>
        {upcoming.length ? (
          <ul className="card divide-y divide-line">
            {upcoming.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-mist/60">
                  <span className="w-32 shrink-0 text-[14px] font-medium tabular-nums">{fmtTz(b.starts_at, "EEE d MMM · HH:mm", s.timezone)}</span>
                  <span className="min-w-0 flex-1 truncate">{b.full_name} <span className="text-muted">· {b.lesson_name}</span></span>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing booked yet." body="Once students book, upcoming lessons will appear here." />}
        <p className="mt-4 text-[13px] text-muted">{totals?.total ?? 0} bookings all time · {totals?.students ?? 0} students</p>
      </section>
    </>
  );
}

function greeting(tz: string) {
  const h = Number(fmtTz(new Date(), "H", tz));
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
