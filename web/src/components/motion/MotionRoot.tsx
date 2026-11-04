"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Site-wide motion: Lenis (sole smooth-scroll engine) wired into GSAP ScrollTrigger.
 * Content is fully visible without JS; the `js-motion` class that hides reveal targets is only
 * added here, and never under prefers-reduced-motion.
 */
export function MotionRoot() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const root = document.documentElement;
      root.classList.add("js-motion");

      const lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), anchors: { offset: -64 } });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(() => {
        // Headings: word-by-word.
        gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
          const words = el.querySelectorAll(".split-word");
          const immediate = el.hasAttribute("data-split-immediate");
          gsap.to(words, {
            opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.06, delay: immediate ? 0.15 : 0,
            scrollTrigger: immediate ? undefined : { trigger: el, start: "top 85%", once: true },
          });
        });
        // Supporting copy and media.
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          const delay = Number(el.dataset.revealDelay ?? 0);
          const immediate = el.hasAttribute("data-reveal-immediate");
          gsap.to(el, {
            opacity: 1, y: 0, duration: 1, ease: "power3.out", delay,
            scrollTrigger: immediate ? undefined : { trigger: el, start: "top 88%", once: true },
          });
        });
        // Scrubbed statement: words brighten as the reader scrolls through.
        gsap.utils.toArray<HTMLElement>("[data-scrub-words]").forEach((el) => {
          gsap.fromTo(el.querySelectorAll(".scrub-word"), { opacity: 0.18 }, {
            opacity: 1, stagger: 0.08, ease: "none",
            scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
          });
        });
      });

      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh);
      window.addEventListener("load", refresh);

      cleanup = () => {
        window.removeEventListener("load", refresh);
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
        ScrollTrigger.getAll().forEach((t) => t.kill());
        root.classList.remove("js-motion");
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [pathname]);

  return null;
}
