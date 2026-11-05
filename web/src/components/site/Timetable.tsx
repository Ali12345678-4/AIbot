"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "../Icon";

export interface BoardRow { date: string; day: string; time: string; lesson: string; slug: string; duration: number }

const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789:";

/**
 * Departure-board timetable of genuinely free lesson slots. Characters settle like a
 * split-flap display when the board enters the viewport. Text is real and readable
 * without JS; the animation only scrambles decorative copies.
 */
export function Timetable({ rows, durationLabel }: { rows: BoardRow[]; durationLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cells = Array.from(el.querySelectorAll<HTMLElement>("[data-flap]"));
    const finals = cells.map((c) => c.textContent ?? "");
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        let done = true;
        cells.forEach((c, i) => {
          const settle = 260 + (i % 40) * 22;
          if (now - start < settle) {
            done = false;
            if (finals[i].trim()) c.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          } else c.textContent = finals[i];
        });
        if (!done) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); cells.forEach((c, i) => (c.textContent = finals[i])); };
  }, []);

  const flap = (text: string) =>
    text.split("").map((ch, i) => (
      <span key={i} className="flap" data-flap aria-hidden="true">{ch === " " ? " " : ch}</span>
    ));

  return (
    <div ref={ref} className="overflow-hidden rounded-[20px] border border-line bg-[#070707]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 md:px-7">
        <span className="label !text-ink">Next available</span>
        <span className="label flex items-center gap-2"><span className="size-1.5 animate-pulse rounded-full bg-accent" />Live</span>
      </div>
      {rows.length === 0 ? (
        <p className="mono px-5 py-10 text-[15px] text-muted md:px-7">TIMETABLE OPENS SOON. CHECK BACK SHORTLY.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.date} className="border-b border-line last:border-0">
              <Link href={`/book?lesson=${r.slug}&date=${r.date}`} className="row-link mono grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 text-[15px] md:grid-cols-[10rem_6rem_1fr_auto] md:gap-8 md:px-7 md:text-[17px]">
                <span className="sr-only">{`${r.day} at ${r.time}, ${r.lesson}. Book this slot.`}</span>
                <span className="text-ink">{flap(r.day)}</span>
                <span className="row-muted font-semibold text-accent-ink">{flap(r.time)}</span>
                <span className="row-muted hidden truncate text-muted md:block" aria-hidden="true">{r.lesson.toUpperCase()} · {durationLabel}</span>
                <span className="flex items-center gap-1 text-[12px] tracking-[0.12em]" aria-hidden="true">BOOK <Icon name="arrow-right-linear" size={14} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
