"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "../Icon";
import { Plate } from "../site/Logo";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overview", icon: "home-2-linear" },
  { href: "/admin/bookings", label: "Bookings", icon: "clipboard-check-linear" },
  { href: "/admin/calendar", label: "Calendar", icon: "calendar-mark-linear" },
  { href: "/admin/availability", label: "Availability", icon: "clock-circle-linear" },
  { href: "/admin/lessons", label: "Lessons", icon: "tag-price-linear" },
  { href: "/admin/students", label: "Students", icon: "users-group-rounded-linear" },
  { href: "/admin/reviews", label: "Reviews", icon: "star-linear" },
  { href: "/admin/emails", label: "Emails", icon: "letter-opened-linear" },
  { href: "/admin/settings", label: "Settings", icon: "settings-linear" },
];

export function AdminNav({ pending, name, logout }: { pending: number; name: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const list = (
    <ul className="space-y-0.5">
      {ITEMS.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            onClick={() => setOpen(false)}
            aria-current={active(i.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors ${
              active(i.href) ? "bg-paper text-ink shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.04)]" : "text-ink-2 hover:bg-black/[.04]"
            }`}
          >
            <Icon name={i.icon} size={19} className={active(i.href) ? "text-accent" : "text-muted"} />
            <span className="flex-1">{i.label}</span>
            {i.href === "/admin/bookings" && pending > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white" aria-label={`${pending} pending`}>{pending}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-[rgba(245,245,247,.85)] px-4 backdrop-blur-xl lg:hidden">
        <Link href="/admin" className="flex items-center gap-2"><Plate /><span className="text-sm font-semibold">Dashboard</span></Link>
        <button type="button" className="grid size-10 place-items-center" aria-expanded={open} aria-controls="admin-menu" aria-label="Menu" onClick={() => setOpen(!open)}>
          <Icon name={open ? "close-circle-linear" : "hamburger-menu-linear"} size={24} />
        </button>
      </div>
      {open && (
        <div id="admin-menu" className="fixed inset-x-0 top-14 z-40 border-b border-line bg-mist p-4 shadow-xl animate-rise lg:hidden">
          <nav aria-label="Dashboard">{list}</nav>
          <form action={logout} className="mt-3 border-t border-line pt-3">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-ink-2 hover:bg-black/[.04]"><Icon name="logout-2-linear" size={19} className="text-muted" />Sign out</button>
          </form>
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-mist p-4 lg:flex">
        <Link href="/admin" className="mb-8 flex items-center gap-2.5 px-2 pt-2"><Plate /><span className="text-[14px] font-semibold">Dashboard</span></Link>
        <nav aria-label="Dashboard" className="flex-1">{list}</nav>
        <div className="border-t border-line pt-4">
          <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] text-muted hover:text-ink"><Icon name="eye-linear" size={18} />View website</Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] text-muted hover:text-ink"><Icon name="logout-2-linear" size={18} />Sign out <span className="truncate text-faint">· {name}</span></button>
          </form>
        </div>
      </aside>
    </>
  );
}
