import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout, requireAdmin } from "@/server/auth";
import { queryOne } from "@/server/db";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" }, robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const p = await queryOne<{ n: number }>("select count(*)::int n from bookings where status = 'pending' and starts_at > now()");
  async function signOut() {
    "use server";
    await logout();
    redirect("/admin/login");
  }
  return (
    <div className="theme-light min-h-dvh bg-canvas lg:flex">
      <AdminNav pending={p?.n ?? 0} name={admin.name ?? admin.email} logout={signOut} />
      <main id="main" className="min-w-0 flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
    </div>
  );
}
