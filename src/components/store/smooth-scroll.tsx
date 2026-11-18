"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

declare global {
  interface Window {
    __bwLenis?: Lenis | null;
  }
}

/**
 * Momentum smooth-scrolling via Lenis. Tuned for responsive inertia without
 * form lag. Exposes window.__bwLenis for synchronized scroll-driven 3D camera
 * & wheel spin and respects prefers-reduced-motion cleanly.
 */
export function SmoothScroll() {
  const rlaf = useRef<number>(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
      smoothWheel: true,
      syncTouch: false,
      overscroll: false,
      anchors: { offset: -84, duration: 1.05 },
    });

    window.__bwLenis = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      rlaf.current = requestAnimationFrame(raf);
    };
    rlaf.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rlaf.current);
      if (window.__bwLenis === lenis) window.__bwLenis = null;
      lenis.destroy();
    };
  }, []);

  return null;
}

export function scrollToTarget(target: HTMLElement | string | number, offset = -84) {
  const lenis = typeof window !== "undefined" ? window.__bwLenis : null;
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.0 });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: "smooth" });
  } else if (typeof target === "string") {
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else {
    target.scrollIntoView({ behavior: "smooth" });
  }
}
