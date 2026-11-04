import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const DEFAULT_TZ = "Europe/London";

export function formatMoney(pence: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} ${h === 1 ? "hour" : "hours"}`;
  return `${m} min`;
}

/** Format an instant in the business timezone. */
export function fmtTz(d: Date | string, pattern: string, tz = DEFAULT_TZ) {
  return format(new TZDate(new Date(d).getTime(), tz), pattern);
}

export const fmtDateLong = (d: Date | string, tz?: string) => fmtTz(d, "EEEE d MMMM yyyy", tz);
export const fmtTime = (d: Date | string, tz?: string) => fmtTz(d, "HH:mm", tz);
