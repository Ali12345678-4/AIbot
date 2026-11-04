import Link from "next/link";
import { query } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageHeader, Empty } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { fmtTz } from "@/lib/format";
import { experienceLabel } from "@/lib/types";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const s = await getSettings();
  const term = q.trim().slice(0, 100);
  const rows = await query<{ id: string; full_name: string; email: string; phone: string; experience: string | null; lessons: number; next: Date | null; last: Date | null }>(
    `select st.id, st.full_name, st.email, st.phone, st.experience,
       count(b.*) filter (where b.status in ('confirmed','completed'))::int lessons,
       min(b.starts_at) filter (where b.starts_at > now() and b.status in ('pending','confirmed')) next,
       max(b.starts_at) filter (where b.starts_at <= now() and b.status in ('confirmed','completed')) last
     from students st left join bookings b on b.student_id = st.id
     where ($1 = '' or st.full_name ilike '%'||$1||'%' or st.email ilike '%'||$1||'%' or st.phone ilike '%'||$1||'%')
     group by st.id order by coalesce(min(b.starts_at) filter (where b.starts_at > now()), st.created_at) asc limit 200`,
    [term],
  );
  return (
    <>
      <PageHeader title="Students" sub={`${rows.length} ${rows.length === 1 ? "student" : "students"}${term ? " found" : ""}`} />
      <form className="card mb-6 flex gap-2 p-4" role="search">
        <label htmlFor="q" className="sr-only">Search students</label>
        <input id="q" name="q" defaultValue={term} placeholder="Search name, email or phone" className="field" />
        <button className="btn btn-primary"><Icon name="magnifier-linear" size={18} /><span className="hidden sm:inline">Search</span></button>
      </form>
      {rows.length === 0 ? <Empty title="No students yet." body="Students are added automatically when they book." /> : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/students/${r.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 transition hover:bg-mist/50">
                <span className="min-w-[180px] flex-1"><span className="block font-medium">{r.full_name}</span><span className="block text-[13px] text-muted">{r.email} · {r.phone}</span></span>
                <span className="text-[13px] text-muted">{experienceLabel(r.experience)}</span>
                <span className="w-24 text-[13px]"><span className="font-semibold">{r.lessons}</span> <span className="text-muted">lessons</span></span>
                <span className="w-36 text-[13px] text-muted">{r.next ? <>Next: <span className="text-ink">{fmtTz(r.next, "d MMM, HH:mm", s.timezone)}</span></> : r.last ? `Last: ${fmtTz(r.last, "d MMM yyyy", s.timezone)}` : "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
