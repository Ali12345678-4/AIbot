import Link from "next/link";
import type { BookingStatus, PaymentStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { Icon } from "../Icon";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] md:text-[2.25rem]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-warn-soft text-warn",
  confirmed: "bg-ok-soft text-ok",
  rejected: "bg-mist text-muted",
  cancelled: "bg-danger-soft text-danger",
  completed: "bg-accent-soft text-accent-ink",
  no_show: "bg-mist text-ink-2",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const PAY_LABEL: Record<PaymentStatus, string> = { unpaid: "Unpaid", authorised: "Card authorised", paid: "Paid", refunded: "Refunded", not_required: "No payment due" };
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const style = status === "paid" ? "text-ok" : status === "authorised" ? "text-accent" : status === "refunded" ? "text-muted" : "text-ink-2";
  return <span className={`text-[13px] font-medium ${style}`}>{PAY_LABEL[status]}</span>;
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div role={error ? "alert" : "status"} className={`mb-6 flex items-start gap-3 rounded-2xl px-5 py-4 text-[15px] animate-rise ${error ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`}>
      <Icon name={error ? "danger-triangle-linear" : "check-circle-linear"} size={20} className="mt-0.5 shrink-0" />
      <p>{error ?? ok}</p>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[14px] text-muted">{body}</p>}
      {action && <Link href={action.href} className="btn btn-primary btn-sm mt-5">{action.label}</Link>}
    </div>
  );
}

export function Stat({ label, value, href, accent }: { label: string; value: React.ReactNode; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`card h-full p-5 ${href ? "card-hover" : ""} ${accent ? "!bg-accent text-white" : ""}`}>
      <p className={`text-[13px] font-medium ${accent ? "text-white/75" : "text-muted"}`}>{label}</p>
      <p className="mt-2 font-display text-[2rem] font-bold tracking-[-0.03em] tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
