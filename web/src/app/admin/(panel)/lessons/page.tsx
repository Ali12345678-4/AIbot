import { query } from "@/server/db";
import { saveLessonAction, deleteLessonAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { formatDuration, formatMoney } from "@/lib/format";
import type { LessonType } from "@/lib/types";

export const metadata = { title: "Lessons" };

function LessonForm({ l }: { l?: LessonType }) {
  const p = l?.id ?? "new";
  return (
    <form action={saveLessonAction} className="grid gap-4 sm:grid-cols-6">
      {l && <input type="hidden" name="id" value={l.id} />}
      <div className="sm:col-span-3"><label className="field-label" htmlFor={`name-${p}`}>Name</label><input id={`name-${p}`} name="name" required maxLength={80} defaultValue={l?.name} placeholder="e.g. Standard lesson" className="field" /></div>
      <div className="sm:col-span-1"><label className="field-label" htmlFor={`dur-${p}`}>Minutes</label><input id={`dur-${p}`} name="duration" type="number" min={15} max={600} step={5} required defaultValue={l?.duration_minutes ?? 60} className="field" /></div>
      <div className="sm:col-span-1"><label className="field-label" htmlFor={`price-${p}`}>Price (£)</label><input id={`price-${p}`} name="price" inputMode="decimal" required defaultValue={l ? (l.price_pence / 100).toFixed(2) : ""} placeholder="0.00" className="field" /></div>
      <div className="sm:col-span-1"><label className="field-label" htmlFor={`sort-${p}`}>Order</label><input id={`sort-${p}`} name="sort_order" type="number" min={0} max={999} defaultValue={l?.sort_order ?? 0} className="field" /></div>
      <div className="sm:col-span-6"><label className="field-label" htmlFor={`desc-${p}`}>Description</label><textarea id={`desc-${p}`} name="description" maxLength={600} defaultValue={l?.description} className="field !min-h-[80px]" placeholder="Who it’s for and what’s covered." /></div>
      <div className="flex flex-wrap items-center gap-5 text-[14px] sm:col-span-6">
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={l?.active ?? true} className="size-4 accent-[var(--color-accent)]" />Bookable online</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={l?.featured} className="size-4 accent-[var(--color-accent)]" />Highlight as popular</label>
        <span className="flex-1" />
        <SubmitButton className="btn btn-primary btn-sm">{l ? "Save" : "Add lesson"}</SubmitButton>
      </div>
    </form>
  );
}

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const lessons = await query<LessonType>("select * from lesson_types order by sort_order, price_pence, name");
  return (
    <>
      <PageHeader title="Lessons" sub="Lesson types, durations and prices shown on your website." />
      <Flash ok={sp.ok} error={sp.error} />
      <section className="card mb-8 p-6">
        <h2 className="mb-4 font-semibold">Add a lesson type</h2>
        <LessonForm />
      </section>
      {lessons.length > 0 && (
        <ul className="space-y-4">
          {lessons.map((l) => (
            <li key={l.id} className="card">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">{l.name}
                      {!l.active && <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-muted">Hidden</span>}
                      {l.featured && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent-ink">Popular</span>}
                    </span>
                    <span className="text-[14px] text-muted">{formatDuration(l.duration_minutes)} · {formatMoney(l.price_pence)}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-accent">Edit</span>
                  <Icon name="alt-arrow-down-linear" size={18} className="text-muted transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-line p-5">
                  <LessonForm l={l} />
                  <form action={deleteLessonAction} className="mt-4 border-t border-line pt-4">
                    <input type="hidden" name="id" value={l.id} />
                    <SubmitButton className="btn btn-danger btn-sm" confirm={`Delete “${l.name}”? Lessons with bookings are hidden instead.`}>Delete</SubmitButton>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
