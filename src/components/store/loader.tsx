"use client";

import { useEffect, useState } from "react";

const SEED_KEY = "bw:lights:done";

/**
 * F1 start-light overlay — five red segments, all dark, then GO.
 * Plays once per browser session; Escape/“Skip” exits immediately;
 * users with prefers-reduced-motion never see it at all.
 */
export function RaceLoader() {
  const [phase, setPhase] = useState<"idle" | "lights" | "out" | "done">("idle");

  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (window.sessionStorage.getItem(SEED_KEY)) return;
      window.sessionStorage.setItem(SEED_KEY, "1");
    } catch {
      return;
    }
    setPhase("lights");
    const timers = [
      window.setTimeout(() => setPhase("out"), 2450),
      window.setTimeout(() => setPhase("done"), 3000),
      window.setTimeout(() => setPhase("done"), 3000),
    ];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        timers.forEach((t) => window.clearTimeout(t));
        setPhase("done");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (phase === "done" || phase === "idle") return null;

  const lightsOn = phase === "lights";
  const five = [0, 1, 2, 3, 4];

  return (
    <div
      className={`fixed inset-0 z-[95] flex flex-col items-center justify-center bg-ink transition-opacity duration-500 ${
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-label="Burnout Wheels loading"
    >
      <div className="u-gridlines" aria-hidden />
      <p className="u-label mb-8">Burnout/wheels — lights out in</p>
      <div className="anim-lights flex gap-1.5" aria-hidden>
        {five.map((i) => (
          <span
            key={i}
            className="u-light-dot"
            data-on={lightsOn ? "true" : "false"}
            style={{ transitionDelay: `${150 + i * 90}ms` }}
          >
            <i style={{ transitionDelay: `${150 + i * 90}ms` }} />
          </span>
        ))}
      </div>
      <p className={`u-mono mt-8 text-xs tracking-[0.4em] transition-all duration-500 ${lightsOn ? "text-red" : "text-mint"}`}>
        {lightsOn ? "FORMATION COMPLETE" : "GO GO GO"}
      </p>
      <button onClick={() => setPhase("done")} className="u-label mt-14 underline-offset-4 hover:underline">
        Skip →
      </button>
    </div>
  );
}
