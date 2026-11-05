import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/session-token";

export interface Admin { id: string; email: string; name: string | null }

export async function currentAdmin(): Promise<Admin | null> {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // Sessions issued before the last password change are invalid.
  return queryOne<Admin>(
    "select id, email, name from admin_users where id = $1 and (password_changed_at is null or extract(epoch from password_changed_at) <= $2 + 1)",
    [s.adminId, s.iat],
  );
}

export async function requireAdmin(): Promise<Admin> {
  const a = await currentAdmin();
  if (!a) redirect("/admin/login");
  return a;
}

const DUMMY_HASH = "$2b$12$4sZSE7ioZkIlIEQH5bODgeY3ccLBqiUdg4YwUqBUO2zp94U6BqgFO"; // timing-safe compare for unknown emails

/**
 * First-run bootstrap: if no admin exists yet and ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD
 * are set on the server, the first sign-in with exactly those credentials creates the account.
 * Remove the variables after the first sign-in.
 */
async function bootstrapAdmin(email: string, password: string) {
  const be = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase().trim();
  const bp = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!be || !bp || bp.length < 10 || email.toLowerCase().trim() !== be || password !== bp) return;
  const any = await queryOne<{ n: number }>("select count(*)::int n from admin_users");
  if ((any?.n ?? 0) > 0) return;
  await query("insert into admin_users (email, name, password_hash) values ($1, null, $2) on conflict do nothing", [be, await bcrypt.hash(bp, 12)]);
}

export async function login(email: string, password: string) {
  await bootstrapAdmin(email, password);
  const user = await queryOne<{ id: string; password_hash: string }>(
    "select id, password_hash from admin_users where email = lower($1)", [email.trim()]);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return false;
  await query("update admin_users set last_login_at = now() where id = $1", [user.id]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function changePassword(adminId: string, current: string, next: string) {
  const u = await queryOne<{ password_hash: string }>("select password_hash from admin_users where id = $1", [adminId]);
  if (!u || !(await bcrypt.compare(current, u.password_hash))) return "Your current password is incorrect.";
  if (next.length < 10) return "New password must be at least 10 characters.";
  await query("update admin_users set password_hash = $2, password_changed_at = now() where id = $1", [adminId, await bcrypt.hash(next, 12)]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(adminId), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86_400 });
  return null;
}
