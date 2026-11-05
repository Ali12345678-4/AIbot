import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/server/auth";
import { Plate } from "@/components/site/Logo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Instructor sign in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");

  return (
    <main className="theme-light grid min-h-dvh place-items-center bg-mist px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Plate className="!px-3 !py-1 !text-[18px]" />
          <h1 className="mt-6 font-display text-[1.75rem] font-bold tracking-[-0.025em]">Instructor sign in</h1>
          <p className="mt-1 text-[15px] text-muted">Manage bookings, availability and lessons.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
