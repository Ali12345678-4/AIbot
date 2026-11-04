import { query } from "@/server/db";
import { saveReviewAction, deleteReviewAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Reviews" };

interface R { id: string; author_name: string; body: string; rating: number | null; source: string | null; published: boolean }

function ReviewForm({ r }: { r?: R }) {
  const p = r?.id ?? "new";
  return (
    <form action={saveReviewAction} className="grid gap-4 sm:grid-cols-4">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="sm:col-span-2"><label className="field-label" htmlFor={`a-${p}`}>Student name (as it should appear)</label><input id={`a-${p}`} name="author_name" required maxLength={80} defaultValue={r?.author_name} placeholder="e.g. Sam P." className="field" /></div>
      <div><label className="field-label" htmlFor={`r-${p}`}>Rating</label>
        <select id={`r-${p}`} name="rating" defaultValue={r?.rating ?? ""} className="field"><option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select></div>
      <div><label className="field-label" htmlFor={`s-${p}`}>Source</label><input id={`s-${p}`} name="source" maxLength={60} defaultValue={r?.source ?? ""} placeholder="e.g. Google" className="field" /></div>
      <div className="sm:col-span-4"><label className="field-label" htmlFor={`b-${p}`}>Review</label><textarea id={`b-${p}`} name="body" required maxLength={1200} defaultValue={r?.body} className="field" /></div>
      <div className="flex items-center gap-4 text-[14px] sm:col-span-4">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={r?.published ?? false} className="size-4 accent-[var(--color-accent)]" />Show on website</label>
        <span className="flex-1" />
        <SubmitButton className="btn btn-primary btn-sm">{r ? "Save" : "Add review"}</SubmitButton>
      </div>
    </form>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const reviews = await query<R>("select id, author_name, body, rating, source, published from reviews order by sort_order, created_at desc");
  return (
    <>
      <PageHeader title="Reviews" sub="Only add genuine reviews from real students, with their permission." />
      <Flash ok={sp.ok} error={sp.error} />
      <section className="card mb-8 p-6"><h2 className="mb-4 font-semibold">Add a review</h2><ReviewForm /></section>
      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="card p-6">
            <ReviewForm r={r} />
            <form action={deleteReviewAction} className="mt-4 border-t border-line pt-4"><input type="hidden" name="id" value={r.id} /><SubmitButton className="btn btn-danger btn-sm" confirm="Delete this review?">Delete</SubmitButton></form>
          </li>
        ))}
      </ul>
    </>
  );
}
