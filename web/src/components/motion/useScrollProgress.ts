"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * Normalised 0..1 progress of a tall section scrolling past the viewport.
 * Native scroll position is the single source of truth (works forwards and backwards).
 * Calls `onProgress` at most once per animation frame. Returns whether motion is allowed.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, onProgress: (p: number) => void) {
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !motion) return;
    let raf = 0;
    let last = -1;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      if (Math.abs(p - last) > 0.0005) { last = p; onProgress(p); }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, motion, onProgress]);

  return motion;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Map p from [a, b] to [0, 1]. */
export const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
