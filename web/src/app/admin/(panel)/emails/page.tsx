import { query } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageHeader, Empty } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { emailConfigured } from "@/server/email";
import { fmtTz } from "@/lib/format";

export const metadata = { title: "Emails" };

export default async function EmailsPage() {
  const s = await getSettings();
  const rows = await query<{ id: string; to_address: string; subject: string; body_text: string; provider: string; status: string; error: string | null; created_at: Date }>(
    "select * from email_log order by created_at desc limit 100");
  const live = emailConfigured();
  return (
    <>
      <PageHeader title="Emails" sub="Every confirmation and notification the system sends." />
      {!live && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-warn-soft px-5 py-4 text-[15px] text-warn" role="status">
          <Icon name="info-circle-linear" size={20} className="mt-0.5 shrink-0" />
          <p><strong>No email provider connected yet.</strong> Emails are recorded here but not delivered. Once a provider is chosen, add its key to the server settings (see README) and they’ll be sent automatically.</p>
        </div>
      )}
      {rows.length === 0 ? <Empty title="No emails yet." /> : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="card">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{m.subject}</span><span className="block text-[13px] text-muted">to {m.to_address}</span></span>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${m.status === "sent" ? "bg-ok-soft text-ok" : m.status === "failed" ? "bg-danger-soft text-danger" : "bg-mist text-muted"}`}>{m.status === "logged" ? "Not sent" : m.status === "sent" ? "Sent" : "Failed"}</span>
                  <span className="text-[13px] tabular-nums text-muted">{fmtTz(m.created_at, "d MMM, HH:mm", s.timezone)}</span>
                </summary>
                <div className="border-t border-line p-5">
                  {m.error && <p className="mb-3 text-[13px] text-danger">{m.error}</p>}
                  <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-2">{m.body_text}</pre>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
