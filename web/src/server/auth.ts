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

export async function login(email: string, password: string) {
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
