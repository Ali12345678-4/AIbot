import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { query, queryOne } from "./db";

export async function clientIp() {
  const h = await headers();
  const raw = h.get("x-nf-client-connection-ip") || h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown";
  // Store only a hash of the IP address.
  return createHash("sha256").update(raw.trim() + (process.env.SESSION_SECRET ?? "")).digest("hex").slice(0, 32);
}

/** Returns true if allowed. Records the hit. */
export async function rateLimit(key: string, max: number, windowMinutes: number) {
  const row = await queryOne<{ n: number }>(
    "select count(*)::int as n from rate_limits where key = $1 and created_at > now() - ($2 || ' minutes')::interval",
    [key, String(windowMinutes)],
  );
  if ((row?.n ?? 0) >= max) return false;
  await query("insert into rate_limits (key) values ($1)", [key]);
  if (Math.random() < 0.02) await query("delete from rate_limits where created_at < now() - interval '1 day'");
  return true;
}
