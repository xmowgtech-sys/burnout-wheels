"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Lenis from "lenis";

/** Momentum smooth-scrolling, disabled for prefers-reduced-motion users. */
export function SmoothScroll() {
  const rlaf = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
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
