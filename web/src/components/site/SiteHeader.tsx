"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Icon } from "../Icon";

const NAV = [
  { href: "/#lessons", label: "Lessons" },
  { href: "/#about", label: "About" },
  { href: "/#why", label: "Why K444AXN" },
  { href: "/#reviews", label: "Reviews" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader({ overDark = false }: { overDark?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const dark = overDark && !scrolled && !open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
        dark ? "on-dark bg-transparent" : "bg-[rgba(251,251,253,0.78)] shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150"
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <div className="container-x flex h-[60px] items-center justify-between gap-6">
        <Logo dark={dark} />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-7">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={`text-[13.5px] font-medium transition-colors ${dark ? "text-white/80 hover:text-white" : "text-ink-2 hover:text-ink"}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/book" className={`btn btn-sm !px-3.5 sm:!px-4 ${dark ? "btn-light" : "btn-primary"}`}>
            Book a lesson
          </Link>
          <button
            type="button"
            className={`grid size-10 place-items-center rounded-full md:hidden ${dark ? "text-white" : "text-ink"}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "close-circle-linear" : "hamburger-menu-linear"} size={24} />
          </button>
        </div>
      </div>
      <div
        id="mobile-nav"
        className={`md:hidden overflow-hidden bg-canvas transition-[max-height,opacity] duration-500 ease-[var(--ease-out-expo)] ${open ? "max-h-[100dvh] opacity-100" : "max-h-0 opacity-0"}`}
        hidden={!open}
      >
        <nav aria-label="Mobile" className="container-x pb-10 pt-4">
          <ul className="flex flex-col">
            {NAV.map((n, i) => (
              <li key={n.href} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link href={n.href} onClick={() => setOpen(false)} className="block border-b border-line py-4 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/book" onClick={() => setOpen(false)} className="btn btn-primary btn-lg mt-8 w-full">
            Book a lesson
          </Link>
        </nav>
      </div>
    </header>
  );
}
