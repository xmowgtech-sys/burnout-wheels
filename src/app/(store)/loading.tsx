"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Flag, Zap, Gauge } from "lucide-react";

export default function StoreLoading() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [mounted, setMounted] = useState(false);

  const stages = [
    { label: "Initializing telemetry…", icon: Gauge, duration: 800 },
    { label: "Connecting to pit wall…", icon: Zap, duration: 1000 },
    { label: "Loading grid formation…", icon: ShieldCheck, duration: 900 },
    { label: "Race ready", icon: Flag, duration: 600 },
  ];

  useEffect(() => {
    setMounted(true);
    let currentProgress = 0;
    let currentStage = 0;
    let frame: number;

    const animate = () => {
      const stageData = stages[currentStage];
      const stageProgress = (currentProgress / stageData.duration) * 100;

      setProgress(Math.min(25 * currentStage + stageProgress * 0.25, 100));

      currentProgress += 16;

      if (currentProgress >= stageData.duration) {
        currentProgress = 0;
        currentStage++;
        setStage(currentStage);

        if (currentStage >= stages.length) {
          return;
        }
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  const currentStageData = stages[Math.min(stage, stages.length - 1)];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 u-gridlines" aria-hidden />

      {/* Subtle red glow sweep */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-red/5 to-transparent animate-sweep"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Brand mark with pulse animation */}
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative grid size-20 place-items-center">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full border-2 border-red/30 animate-ping-opacity" aria-hidden />
            <div className="absolute inset-0 rounded-full border-2 border-red/10 animate-ping-opacity" style={{ animationDelay: "0.5s" }} aria-hidden />

            {/* Brand badge */}
            <svg viewBox="0 0 64 64" className="size-16" aria-hidden>
              <defs>
                <linearGradient id="load-c" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f2f5f8" />
                  <stop offset="0.55" stopColor="#8e959c" />
                  <stop offset="1" stopColor="#6d747b" />
                </linearGradient>
                <linearGradient id="load-r" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ff5a48" />
                  <stop offset="0.5" stopColor="#e10600" />
                  <stop offset="1" stopColor="#b00400" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="28" fill="url(#load-c)" />
              <circle cx="32" cy="32" r="23.5" fill="#141618" />
              <circle cx="32" cy="32" r="22" fill="none" stroke="url(#load-r)" strokeWidth="3" />
              <text x="15" y="50" transform="rotate(-8 32 32)" fontFamily="'Arial Black',system-ui,sans-serif" fontSize="30" fontWeight="900" fill="url(#load-c)" stroke="#20242a" strokeWidth="1.6" paintOrder="stroke" letterSpacing="-2">B</text>
              <text x="30" y="54" transform="rotate(-8 32 32)" fontFamily="'Arial Black',system-ui,sans-serif" fontSize="30" fontWeight="900" fill="url(#load-r)" stroke="#470402" strokeWidth="1.6" paintOrder="stroke" letterSpacing="-2">W</text>
            </svg>
          </div>

          <div className="text-center">
            <p className="whitespace-nowrap text-sm font-extrabold uppercase tracking-[0.18em] text-bone">
              Burnout<span className="text-red">/</span>Wheels
            </p>
            <p className="mt-1 u-mono text-xs text-dim tracking-[0.3em]">DIE-CAST PIT LANE</p>
          </div>
        </div>

        {/* Stage indicator with icon */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative grid size-12 place-items-center rounded-full bg-red/10 border border-red/20">
            <currentStageData.icon className="size-5 text-red" aria-hidden />
          </div>
          <p className="u-label text-bone min-w-[220px] text-center">{currentStageData.label}</p>
        </div>

        {/* Progress bar */}
        <div className="relative w-full max-w-md">
          <div className="h-2 rounded-full bg-line overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red via-red/80 to-yellow transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Loading progress"
            />
          </div>
          <p className="mt-2 u-mono text-xs text-dim text-right">{Math.round(Math.min(progress, 100))}%</p>
        </div>

        {/* Animated track marks */}
        <div className="flex items-center justify-center gap-1 mt-4" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-px bg-red/20 rounded animate-track-mark"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        <p className="u-label-txt text-dim">Mohali → Pan-India · Sealed & Inspected</p>
      </div>

      <style jsx>{`
        @keyframes ping-opacity {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes track-mark {
          0%, 100% { opacity: 0.2; transform: scaleX(0.5); }
          50% { opacity: 1; transform: scaleX(1.2); background: #e10600; }
        }
        .animate-ping-opacity { animation: ping-opacity 2s ease-in-out infinite; }
        .animate-sweep { animation: sweep 3s ease-in-out infinite; }
        .animate-track-mark { animation: track-mark 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}