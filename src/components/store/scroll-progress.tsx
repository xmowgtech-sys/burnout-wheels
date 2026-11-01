"use client";

import { useEffect, useRef } from "react";

/**
 * Thin spectrum lap-line under the fixed header. Writes the scale directly to
 * the DOM — no React state per scroll frame, so it never re-renders the header.
 */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
      <div
        ref={bar}
        className="u-spectrum h-full w-full origin-left shadow-[0_0_14px_rgba(225,6,0,0.45)]"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
