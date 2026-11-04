import Link from "next/link";
import { query } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageHeader, StatusBadge, PaymentBadge, Empty } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { fmtTz, formatMoney } from "@/lib/format";
import { zonedToEpoch, addDaysYmd } from "@/lib/availability";
import { STATUS_LABEL, type BookingStatus, type PaymentStatus } from "@/lib/types";

export const metadata = { title: "Bookings" };
const PAGE = 25;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const status = sp.status && sp.status in STATUS_LABEL ? sp.status : "";
  const when = ["upcoming", "past", "all"].includes(sp.when ?? "") ? sp.when! : "upcoming";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (status) where.push(`b.status = ${p(status)}`);
  if (q) { const v = p(`%${q}%`); where.push(`(s.full_name ilike ${v} or s.email ilike ${v} or s.phone ilike ${v} or b.reference ilike ${v})`); }
  if (from) where.push(`b.starts_at >= ${p(new Date(zonedToEpoch(from, "00:00", s.timezone)))}`);
  if (to) where.push(`b.starts_at < ${p(new Date(zonedToEpoch(addDaysYmd(to, 1), "00:00", s.timezone)))}`);
  if (!from && !to && when === "upcoming") where.push("b.ends_at >= now()");
  if (!from && !to && when === "past") where.push("b.ends_at < now()");
  const order = when === "past" ? "desc" : "asc";

  const rows = await query<{ id: string; reference: string; starts_at: Date; lesson_name: string; price_pence: number; status: BookingStatus; payment_status: PaymentStatus; full_name: string; email: string; total: number }>(
    `select b.id, b.reference, b.starts_at, b.lesson_name, b.price_pence, b.status, b.payment_status, s.full_name, s.email, count(*) over()::int total
     from bookings b join students s on s.id = b.student_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by b.starts_at ${order} limit ${PAGE} offset ${(page - 1) * PAGE}`,
    params,
  );
  const total = rows[0]?.total ?? 0;
  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams({ ...(status && { status }), ...(q && { q }), ...(from && { from }), ...(to && { to }), when, ...patch });
    return `/admin/bookings?${u}`;
  };

  return (
    <>
      <PageHeader title="Bookings" sub={`${total} ${total === 1 ? "booking" : "bookings"}`} actions={<Link href="/admin/bookings/new" className="btn btn-primary btn-sm"><Icon name="add-circle-linear" size={18} />New booking</Link>} />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-mist p-1 text-[14px] font-medium sm:inline-flex" role="tablist" aria-label="Time range">
        {(["upcoming", "past", "all"] as const).map((w) => (
          <Link key={w} role="tab" aria-selected={when === w} href={qs({ when: w, page: "1" })} className={`rounded-full px-4 py-1.5 capitalize ${when === w ? "bg-paper shadow-sm" : "text-muted hover:text-ink"}`}>{w}</Link>
        ))}
      </div>

      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
        <input type="hidden" name="when" value={when} />
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search name, email, phone or reference" className="field" />
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="field">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="sr-only" htmlFor="from">From</label>
        <input id="from" name="from" type="date" defaultValue={from} className="field" aria-label="From date" />
        <label className="sr-only" htmlFor="to">To</label>
        <input id="to" name="to" type="date" defaultValue={to} className="field" aria-label="To date" />
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1"><Icon name="magnifier-linear" size={18} />Filter</button>
          {(q || status || from || to) && <Link href="/admin/bookings" className="btn btn-ghost">Clear</Link>}
        </div>
      </form>

      {rows.length === 0 ? (
        <Empty title="No bookings found." body={q || status || from || to ? "Try changing your filters." : "New bookings will appear here."} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead className="hidden border-b border-line bg-mist/50 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted md:table-header-group">
              <tr><th className="px-5 py-3">When</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Lesson</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Price</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => (
                <tr key={b.id} className="group relative flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-mist/50 md:table-row md:p-0">
                  <td className="w-full font-medium tabular-nums md:w-auto md:px-5 md:py-4">
                    <Link href={`/admin/bookings/${b.id}`} className="after:absolute after:inset-0">{fmtTz(b.starts_at, "EEE d MMM yyyy · HH:mm", s.timezone)}</Link>
                  </td>
                  <td className="md:px-5 md:py-4"><span className="font-medium">{b.full_name}</span><span className="hidden text-[13px] text-muted lg:block">{b.email}</span></td>
                  <td className="text-muted md:px-5 md:py-4">{b.lesson_name}<span className="block font-mono text-[11px] text-faint">{b.reference}</span></td>
                  <td className="md:px-5 md:py-4"><StatusBadge status={b.status} /></td>
                  <td className="ml-auto text-right md:px-5 md:py-4"><span className="block font-semibold">{formatMoney(b.price_pence, s.currency)}</span><PaymentBadge status={b.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <nav className="mt-6 flex items-center justify-between text-[14px]" aria-label="Pagination">
          {page > 1 ? <Link className="btn btn-ghost btn-sm" href={qs({ page: String(page - 1) })}>Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total ? <Link className="btn btn-ghost btn-sm" href={qs({ page: String(page + 1) })}>Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
