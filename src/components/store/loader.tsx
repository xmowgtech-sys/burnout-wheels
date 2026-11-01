"use client";

import { useEffect, useState } from "react";

const SEED_KEY = "bw:lights:done";

/**
 * Clean start-light loader — badge logo reveal, red sweep, five F1 lights, GO.
 * Plays once per browser session; Escape/Skip exits immediately;
 * prefers-reduced-motion never sees it at all.
 */
export function RaceLoader() {
  const [phase, setPhase] = useState<"idle" | "lights" | "out" | "done">("idle");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (phase !== "lights") return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const p = Math.min(100, Math.round(((performance.now() - started) / 2600) * 100));
      setPct(p);
      if (p >= 100) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, [phase]);

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
      window.setTimeout(() => setPhase("out"), 2600),
      window.setTimeout(() => setPhase("done"), 3150),
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
      className={`fixed inset-0 z-[95] flex flex-col items-center justify-center bg-ink transition-opacity duration-[450ms] ease-out ${
        phase === "out" ? "pointer-events-none scale-[1.015] opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-label="Burnout Wheels loading"
    >
      <div className="u-gridlines" aria-hidden />
      <div className="u-spectrum absolute inset-x-0 top-0 h-[2px] origin-left" style={{ transform: `scaleX(${pct / 100})` }} aria-hidden />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 md:p-8">
        <p className="u-label">Burnout/wheels</p>
        <p className="u-label">Pit lane — Mohali</p>
      </div>

      {/* badge reveal */}
      <div className="bw-badge-reveal relative mb-9">
        <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(225,6,0,0.34),transparent_66%)] blur-md" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={168} height={168} className="relative size-[168px] select-none" draggable={false} />
      </div>

      {/* red sweep line */}
      <div className="relative mb-10 h-px w-[min(78vw,340px)] overflow-visible" aria-hidden>
        <span className="absolute inset-x-0 top-0 h-px bg-line-strong" />
        <span className="bw-sweep absolute top-0 h-[3px] w-24 -translate-y-[1px] rounded-full bg-gradient-to-r from-transparent via-red to-transparent" />
      </div>

      <p className="u-label mb-7">Lights out in</p>
      <div className="flex gap-1.5" aria-hidden>
        {five.map((i) => (
          <span
            key={i}
            className="u-light-dot"
            data-on={lightsOn ? "true" : "false"}
            style={{ transitionDelay: `${250 + i * 120}ms` }}
          >
            <i style={{ transitionDelay: `${250 + i * 120}ms` }} />
          </span>
        ))}
      </div>
      <p
        aria-live="polite"
        className={`u-mono mt-9 text-xs font-bold tracking-[0.45em] transition-colors duration-500 ${lightsOn ? "text-red" : "text-mint"}`}
      >
        {lightsOn ? "FORMATION COMPLETE" : "LIGHTS OUT — GO GO GO"}
      </p>
      <button onClick={() => setPhase("done")} className="u-label mt-14 underline-offset-4 hover:underline">
        Skip
      </button>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 md:p-8">
        <p className="u-label">Lights sequence / 001</p>
        <p className="u-mono text-3xl font-bold tabular-nums">
          {String(pct).padStart(3, "0")}
          <span className="ml-1 text-sm text-dim">%</span>
        </p>
      </div>
    </div>
  );
}
