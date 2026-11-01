"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Momentum smooth-scrolling. Tuned for a cinematic, weighty feel without the
 * floaty lag that makes forms feel broken. Native touch inertia stays on
 * (syncTouch: false) — phones scroll the way thumbs expect.
 * Disabled entirely for prefers-reduced-motion users.
 */
export function SmoothScroll() {
  const rlaf = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true,
      syncTouch: false,
      overscroll: false,
      anchors: { offset: -88, duration: 1.1 },
    });

    const raf = (time: number) => {
      lenis.raf(time);
      rlaf.current = requestAnimationFrame(raf);
    };
    rlaf.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rlaf.current);
      lenis.destroy();
    };
  }, []);

  return null;
}
