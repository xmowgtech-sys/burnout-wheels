"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, HelpCircle, Star } from "lucide-react";
import {
  animateSakugaSpring,
  emitSakuga,
  emitSakugaFromElement,
  useSakugaVfx,
} from "./sakuga-vfx-layer";
import { SAKUGA_PALETTE, stepSpring } from "@/lib/sakuga-vfx";
import { cn } from "@/lib/utils";

/* ============================================================================
 * 1 & 2. SakugaButton (Primary impact burst & Secondary slash)
 * ============================================================================ */

export function SakugaButton({
  variant = "primary",
  label,
  sfxLabel,
  onClick,
  className,
  disabled,
}: {
  variant?: "primary" | "secondary";
  label: string;
  sfxLabel?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = btnRef.current;
    animateSakugaSpring(el, variant === "primary" ? "heavy" : "snappy");
    const rect = el?.getBoundingClientRect();
    const x = e.clientX > 0 ? e.clientX : (rect ? rect.left + rect.width / 2 : 0);
    const y = e.clientY > 0 ? e.clientY : (rect ? rect.top + rect.height / 2 : 0);

    if (variant === "primary") {
      emitSakuga("impact", x, y, {
        accent: SAKUGA_PALETTE.primary,
        label: sfxLabel ?? "ドン!",
        scale: 1.08,
      });
    } else {
      emitSakuga("slash", x, y, {
        accent: SAKUGA_PALETTE.sky,
        label: sfxLabel ?? "シュッ!",
        scale: 1.0,
      });
    }
    onClick?.();
  };

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled}
      data-sakuga-managed="true"
      onClick={handleClick}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center whitespace-nowrap border-2 px-6 py-2.5 font-mono text-xs font-extrabold uppercase tracking-[0.18em] transition-colors select-none cursor-pointer disabled:opacity-45",
        variant === "primary"
          ? "border-bone bg-red text-white shadow-[4px_4px_0_#ffe600] hover:bg-ember"
          : "border-bone bg-ink text-bone shadow-[4px_4px_0_#7cb8ff] hover:bg-panel",
        className
      )}
    >
      {label}
    </button>
  );
}

/* ============================================================================
 * 3. SakugaToggle (Spring thumb overshoot + smoke puff)
 * ============================================================================ */

export function SakugaToggle({
  label,
  ariaLabel,
  checked,
  onChange,
}: {
  label: string;
  ariaLabel?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const switchRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  const toggle = () => {
    const next = !checked;
    onChange(next);
    animateSakugaSpring(switchRef.current, "pop");
    animateSakugaSpring(thumbRef.current, "heavy");
    emitSakugaFromElement(switchRef.current, "smoke", {
      accent: next ? SAKUGA_PALETTE.mint : SAKUGA_PALETTE.sky,
      label: next ? "パチッ!" : "OFF!",
      scale: 0.92,
    });
  };

  return (
    <div className="inline-flex items-center gap-3">
      <button
        ref={switchRef}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        data-sakuga-managed="true"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-10 w-[72px] shrink-0 items-center border-2 p-1 transition-colors duration-200 cursor-pointer",
          checked
            ? "border-bone bg-mint/25 shadow-[3px_3px_0_#2dd4a0]"
            : "border-line-strong bg-ink shadow-[3px_3px_0_rgba(244,244,240,0.16)]"
        )}
      >
        <span
          ref={thumbRef}
          className={cn(
            "block size-7 border-2 border-ink transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            checked ? "translate-x-8 bg-mint" : "translate-x-0 bg-bone"
          )}
        />
      </button>
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-bone">{label}</span>
    </div>
  );
}

/* ============================================================================
 * 4. SakugaSlider (Velocity-based spring overshoot on release + splash sparks)
 * ============================================================================ */

export function SakugaSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const { reducedMotion, enabled } = useSakugaVfx();
  const trackRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const lastSampleRef = useRef<{ val: number; time: number }>({ val: value, time: 0 });
  const velRef = useRef(0);
  const springRafRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (springRafRef.current !== null) window.cancelAnimationFrame(springRafRef.current);
    };
  }, []);

  const handleInput = (nextVal: number) => {
    const now = performance.now();
    const dt = Math.max(8, now - lastSampleRef.current.time);
    velRef.current = ((nextVal - lastSampleRef.current.val) / dt) * 1000;
    lastSampleRef.current = { val: nextVal, time: now };
    onChange(nextVal);
    setDisplayValue(nextVal);
  };

  const handleRelease = () => {
    const v = velRef.current;
    velRef.current = 0;

    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const thumbX = rect.left + (value / 100) * rect.width;
      const thumbY = rect.top + rect.height / 2;
      const fast = Math.abs(v) > 90;
      emitSakuga(fast ? "splash" : "sparkle", thumbX, thumbY, {
        accent: value >= 80 ? SAKUGA_PALETTE.primary : SAKUGA_PALETTE.yellow,
        label: fast ? "ブーン!" : undefined,
        scale: fast ? 0.95 : 0.72,
      });
    }

    if (reducedMotion || !enabled || Math.abs(v) < 35) {
      setDisplayValue(value);
      return;
    }

    if (springRafRef.current !== null) window.cancelAnimationFrame(springRafRef.current);
    let state = { value, velocity: Math.max(-420, Math.min(420, v * 0.65)) };
    let lastTs = performance.now();

    const step = (now: number) => {
      const dtSec = Math.min(0.032, (now - lastTs) / 1000);
      lastTs = now;
      state = stepSpring(state, value, dtSec, { stiffness: 280, damping: 12, mass: 1 });
      const clamped = Math.max(-4, Math.min(104, state.value));
      setDisplayValue(clamped);

      if (Math.abs(state.value - value) > 0.25 || Math.abs(state.velocity) > 1.5) {
        springRafRef.current = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
        springRafRef.current = null;
      }
    };
    springRafRef.current = window.requestAnimationFrame(step);
  };

  const pct = Math.max(0, Math.min(100, displayValue));

  return (
    <div className="w-full max-w-[260px] pt-7">
      <div ref={trackRef} className="relative flex h-6 items-center">
        {/* Floating callout badge tracking spring position */}
        <div
          aria-hidden="true"
          style={{ left: `${pct}%` }}
          className="u-mono pointer-events-none absolute -top-8 -translate-x-1/2 whitespace-nowrap border-2 border-bone bg-ink px-2 py-0.5 text-[11px] font-bold text-yellow shadow-[2px_2px_0_#e10600]"
        >
          {Math.round(value)}%
        </div>

        {/* Visual track */}
        <div className="h-2.5 w-full overflow-hidden border-2 border-bone bg-ink">
          <div
            className="h-full bg-gradient-to-r from-red via-orange to-yellow"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Visual thumb */}
        <div
          aria-hidden="true"
          style={{ left: `${pct}%` }}
          className="pointer-events-none absolute size-5 -translate-x-1/2 border-2 border-ink bg-bone shadow-[2px_2px_0_#e10600]"
        />

        {/* Native accessible slider overlay */}
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          aria-label={label}
          data-sakuga-managed="true"
          onChange={(e) => handleInput(Number(e.target.value))}
          onPointerUp={handleRelease}
          onKeyUp={handleRelease}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

/* ============================================================================
 * 5. SakugaCheckbox (Squash pop + animated ink tick + puff burst)
 * ============================================================================ */

export function SakugaCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  const boxRef = useRef<HTMLSpanElement>(null);

  const toggle = (next: boolean) => {
    onChange(next);
    animateSakugaSpring(boxRef.current, "pop");
    emitSakugaFromElement(boxRef.current, next ? "check" : "smoke", {
      accent: next ? SAKUGA_PALETTE.mint : SAKUGA_PALETTE.sky,
      label: next ? "パチッ!" : "",
      scale: 0.78,
    });
  };

  return (
    <label
      htmlFor={id}
      data-sakuga-managed="true"
      className="inline-flex cursor-pointer items-center gap-3 select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => toggle(e.target.checked)}
        className="sr-only"
      />
      <span
        ref={boxRef}
        aria-hidden="true"
        className={cn(
          "grid size-7 place-items-center border-2 transition-colors",
          checked
            ? "border-bone bg-mint text-ink shadow-[3px_3px_0_#ffe600]"
            : "border-bone bg-ink text-transparent shadow-[3px_3px_0_rgba(244,244,240,0.2)]"
        )}
      >
        <Check className="size-4 stroke-[3]" />
      </span>
      <span className="text-sm font-semibold text-bone">{label}</span>
    </label>
  );
}

/* ============================================================================
 * 6. SakugaRadioGroup (Spring dot overshoot + smoke/spark ring)
 * ============================================================================ */

export function SakugaRadioGroup({
  name,
  ariaLabel,
  options,
  value,
  onChange,
}: {
  name: string;
  ariaLabel: string;
  options: { value: string; label: string; accent?: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-col gap-3">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            data-sakuga-managed="true"
            className="inline-flex cursor-pointer items-center gap-3 select-none"
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={(e) => {
                onChange(opt.value);
                const dot = e.currentTarget.nextElementSibling;
                if (dot instanceof HTMLElement) {
                  animateSakugaSpring(dot, "pop");
                  emitSakugaFromElement(dot, "smoke", {
                    accent: opt.accent ?? SAKUGA_PALETTE.primary,
                    label: "パチッ!",
                    scale: 0.72,
                  });
                }
              }}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 place-items-center rounded-full border-2 transition-colors",
                active
                  ? "border-bone bg-ink shadow-[2px_2px_0_#e10600]"
                  : "border-line-strong bg-ink"
              )}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  active ? "scale-100 bg-red" : "scale-0 bg-red"
                )}
              />
            </span>
            <span className={cn("text-sm font-medium", active ? "text-bone" : "text-fog")}>
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 7. SakugaInput (Focus bounce + subtle kinetic keystroke sparks)
 * ============================================================================ */

export function SakugaInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const sparkAtEdge = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const caretRatio = Math.min(0.88, Math.max(0.14, (el.value.length * 9) / Math.max(120, rect.width)));
    emitSakuga("keyspark", rect.left + rect.width * caretRatio, rect.top + 8, {
      scale: 0.85,
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      data-sakuga-managed="true"
      onFocus={() => {
        animateSakugaSpring(inputRef.current, "snappy");
        emitSakugaFromElement(inputRef.current, "slash", {
          accent: SAKUGA_PALETTE.yellow,
          label: "",
          scale: 0.65,
        });
      }}
      onChange={(e) => {
        onChange(e.target.value);
        sparkAtEdge();
      }}
      className="w-full max-w-[260px] border-2 border-bone bg-ink px-3.5 py-2.5 font-mono text-xs text-bone shadow-[4px_4px_0_rgba(244,244,240,0.2)] transition-shadow placeholder:text-dim focus:border-yellow focus:shadow-[4px_4px_0_#e10600] focus:outline-none"
    />
  );
}

/* ============================================================================
 * 8. SakugaTabs (Arrow-key navigation + spring highlight + slash sweep)
 * ============================================================================ */

export function SakugaTabs({
  ariaLabel,
  tabs,
  value,
  onChange,
}: {
  ariaLabel: string;
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectTab = (index: number) => {
    const target = tabs[index];
    if (!target || target.id === value) return;
    onChange(target.id);
    const btn = tabRefs.current[index];
    animateSakugaSpring(btn, "snappy");
    emitSakugaFromElement(btn, "slash", {
      accent: SAKUGA_PALETTE.primary,
      label: "シュッ!",
      scale: 0.82,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      selectTab(nextIdx);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex border-2 border-bone bg-ink p-1 shadow-[4px_4px_0_rgba(244,244,240,0.18)]"
    >
      {tabs.map((tab, i) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-sakuga-managed="true"
            onClick={() => selectTab(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "whitespace-nowrap px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer",
              active ? "bg-red text-white" : "text-fog hover:text-bone"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 9. SakugaProgress (Surging anime progress bar + 100% checkmark burst)
 * ============================================================================ */

export function SakugaProgress({
  label,
  onDone,
}: {
  label: string;
  onDone?: () => void;
}) {
  const barRef = useRef<HTMLButtonElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [runId, setRunId] = useState(1);

  useEffect(() => {
    setPct(0);
    setDone(false);
    // Surge keyframes mimicking anime loading bursts
    const steps: [number, number][] = [
      [180, 18],
      [420, 44],
      [760, 72],
      [1040, 91],
      [1260, 100],
    ];
    const timers = steps.map(([delay, val]) =>
      window.setTimeout(() => {
        setPct(val);
        if (val === 100) {
          setDone(true);
          animateSakugaSpring(barRef.current, "pop");
          emitSakugaFromElement(barRef.current, "check", {
            accent: SAKUGA_PALETTE.mint,
            label: "完了!",
            scale: 0.95,
          });
          onDoneRef.current?.();
        }
      }, delay)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [runId]);

  const replay = () => {
    animateSakugaSpring(barRef.current, "snappy");
    emitSakugaFromElement(barRef.current, "splash", {
      accent: SAKUGA_PALETTE.primary,
      label: "GO!",
      scale: 0.78,
    });
    setRunId((n) => n + 1);
  };

  return (
    <button
      ref={barRef}
      type="button"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-sakuga-managed="true"
      onClick={replay}
      className="group relative w-full max-w-[260px] cursor-pointer text-left"
    >
      <div className="relative h-6 w-full overflow-hidden border-2 border-bone bg-ink shadow-[4px_4px_0_rgba(244,244,240,0.2)]">
        <div
          className={cn(
            "h-full transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            done ? "bg-mint" : "bg-gradient-to-r from-red via-ember to-yellow"
          )}
          style={{ width: `${pct}%` }}
        />
        <span
          className={cn(
            "u-mono pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-extrabold",
            done ? "text-ink" : "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
          )}
        >
          {pct}%
        </span>
      </div>
    </button>
  );
}

/* ============================================================================
 * 10. SakugaRating (Staggered wave bounce + star sparkle burst)
 * ============================================================================ */

export function SakugaRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
}) {
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handlePick = (stars: number) => {
    onChange(stars);
    for (let i = 0; i < stars; i++) {
      const el = starRefs.current[i];
      window.setTimeout(() => {
        animateSakugaSpring(el, "pop");
      }, i * 48);
    }
    const target = starRefs.current[stars - 1];
    emitSakugaFromElement(target, stars === 5 ? "impact" : "sparkle", {
      accent: SAKUGA_PALETTE.yellow,
      label: stars === 5 ? "キラッ!!" : "キラッ!",
      scale: stars === 5 ? 1.05 : 0.85,
    });
  };

  return (
    <div role="radiogroup" aria-label="Rating" className="inline-flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n, i) => {
        const lit = n <= value;
        return (
          <button
            key={n}
            ref={(el) => {
              starRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={n === 1 ? "1 star" : `${n} stars`}
            data-sakuga-managed="true"
            onClick={() => handlePick(n)}
            className="grid size-10 place-items-center transition-transform hover:scale-110 cursor-pointer"
          >
            <Star
              className={cn(
                "size-7 transition-colors",
                lit ? "fill-yellow text-yellow" : "text-fog hover:text-bone"
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 11. SakugaTooltip (Hover / focus / tap cel-shaded spring callout)
 * ============================================================================ */

export function SakugaTooltip({
  hint,
  buttonLabel = "Help",
}: {
  hint: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  const reveal = useCallback(
    (shouldBurst: boolean) => {
      setOpen(true);
      if (shouldBurst) {
        animateSakugaSpring(btnRef.current, "pop");
        emitSakugaFromElement(btnRef.current, "sparkle", {
          accent: SAKUGA_PALETTE.sky,
          label: "",
          scale: 0.62,
        });
      }
      window.requestAnimationFrame(() => animateSakugaSpring(tipRef.current, "pop"));
    },
    []
  );

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => reveal(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        id={tipId}
        ref={tipRef}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute -top-12 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-2 border-bone bg-ink px-3 py-1.5 font-mono text-[11px] font-bold text-bone shadow-[3px_3px_0_#e10600] transition-opacity duration-150",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {hint}
      </div>
      <button
        ref={btnRef}
        type="button"
        aria-label={buttonLabel}
        aria-describedby={open ? tipId : undefined}
        data-sakuga-managed="true"
        onFocus={() => reveal(false)}
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : reveal(true))}
        className="grid size-11 place-items-center rounded-full border-2 border-bone bg-ink text-bone shadow-[3px_3px_0_#7cb8ff] transition-colors hover:border-yellow hover:text-yellow cursor-pointer"
      >
        <HelpCircle className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
