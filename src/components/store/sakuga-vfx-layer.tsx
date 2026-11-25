"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SAKUGA_PALETTE,
  classifySakugaTarget,
  createSakugaEffect,
  stepSakugaEffects,
  type SakugaEffect,
  type SakugaEffectKind,
  type SpawnEffectOptions,
} from "@/lib/sakuga-vfx";

const STORAGE_KEY = "bw:sakuga-vfx:v1";

interface SakugaTriggerEvent {
  kind: SakugaEffectKind;
  x: number;
  y: number;
  options?: SpawnEffectOptions;
}

type Listener = (ev: SakugaTriggerEvent) => void;
const listeners = new Set<Listener>();

/**
 * Imperative helper so any client component (ProductCard, ToastProvider,
 * SakugaControls, etc.) can spawn a Sakuga VFX burst at exact viewport coords.
 */
export function emitSakuga(
  kind: SakugaEffectKind,
  x: number,
  y: number,
  options?: SpawnEffectOptions
): void {
  if (typeof window === "undefined") return;
  for (const fn of listeners) {
    fn({ kind, x, y, options });
  }
}

/** Convenience helper to spawn a Sakuga VFX burst centered on an element. */
export function emitSakugaFromElement(
  el: Element | null | undefined,
  kind: SakugaEffectKind,
  options?: SpawnEffectOptions
): void {
  if (!el || typeof window === "undefined") return;
  const rect = el.getBoundingClientRect();
  emitSakuga(kind, rect.left + rect.width / 2, rect.top + rect.height / 2, options);
}

/**
 * Applies a compositor-only anime spring squash-and-overshoot animation using
 * the Web Animations API (`transform` only — zero layout reflow).
 */
export function animateSakugaSpring(
  el: HTMLElement | null | undefined,
  mode: "heavy" | "snappy" | "pop" = "snappy"
): void {
  if (!el || typeof el.animate !== "function") return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const keyframes: Keyframe[] =
    mode === "heavy"
      ? [
          { transform: "scale3d(1, 1, 1)" },
          { transform: "scale3d(1.13, 0.84, 1)", offset: 0.22 },
          { transform: "scale3d(0.93, 1.09, 1)", offset: 0.54 },
          { transform: "scale3d(1.03, 0.98, 1)", offset: 0.78 },
          { transform: "scale3d(1, 1, 1)" },
        ]
      : mode === "pop"
        ? [
            { transform: "scale3d(1, 1, 1)" },
            { transform: "scale3d(0.82, 1.18, 1)", offset: 0.24 },
            { transform: "scale3d(1.16, 0.9, 1)", offset: 0.56 },
            { transform: "scale3d(0.98, 1.03, 1)", offset: 0.8 },
            { transform: "scale3d(1, 1, 1)" },
          ]
        : [
            { transform: "scale3d(1, 1, 1)" },
            { transform: "scale3d(1.08, 0.9, 1)", offset: 0.25 },
            { transform: "scale3d(0.97, 1.05, 1)", offset: 0.6 },
            { transform: "scale3d(1, 1, 1)" },
          ];

  try {
    el.animate(keyframes, {
      duration: mode === "heavy" ? 390 : mode === "pop" ? 340 : 280,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  } catch {
    /* ignore unsupported WAAPI edge cases */
  }
}

/* ==================== Canvas Drawing Routines ==================== */

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  rot: number,
  fill: string,
  stroke: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 4;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  fill: string,
  stroke: string,
  alpha: number
) {
  if (r <= 1 || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Main cel-shaded anime cloud silhouette (3 overlapping lobes)
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.arc(r * 0.52, -r * 0.16, r * 0.68, 0, Math.PI * 2);
  ctx.arc(-r * 0.48, r * 0.12, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  // Crisp manga outer stroke around main lobe
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  // Hand-drawn inner manga crease arc
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.56, 0.3, 1.9);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.restore();
}

function drawEffect(ctx: CanvasRenderingContext2D, fx: SakugaEffect): void {
  const progress = Math.max(0, Math.min(1, fx.age / fx.duration));
  const inv = 1 - progress;

  ctx.save();
  ctx.translate(fx.x, fx.y);

  // 1. Jagged anime impact burst polygon + shockwave ring
  if (fx.kind === "impact" && fx.burstSpikes.length > 0) {
    const burstPhase = Math.min(1, progress / 0.52);
    const burstAlpha = progress < 0.12 ? 1 : Math.max(0, 1 - (progress - 0.12) / 0.45);
    const scale = easeOutBack(burstPhase);
    const r = fx.burstRadius * scale;

    if (burstAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = burstAlpha;

      // Outer shockwave ring
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1.5, 4 * (1 - burstPhase));
      ctx.strokeStyle = SAKUGA_PALETTE.yellow;
      ctx.stroke();

      // Jagged radial burst polygon
      ctx.beginPath();
      const count = fx.burstSpikes.length;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const rad = r * 1.15 * fx.burstSpikes[i]!;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad * 0.86;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fx.accent;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = SAKUGA_PALETTE.yellow;
      ctx.stroke();

      // Bright white comic impact core
      if (progress < 0.34) {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const rad = r * 0.62 * fx.burstSpikes[i]!;
          const px = Math.cos(angle) * rad;
          const py = Math.sin(angle) * rad * 0.86;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = SAKUGA_PALETTE.bone;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 2. Diagonal anime wind/katana slash crescent
  if (fx.kind === "slash" && fx.slashRadius > 0) {
    const slashPhase = easeOutCubic(Math.min(1, progress / 0.72));
    const slashAlpha = Math.max(0, 1 - progress * 1.2);
    if (slashAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = slashAlpha;
      ctx.rotate(fx.slashAngle);
      const span = fx.slashRadius * (0.45 + slashPhase * 0.9);
      const arcLift = 18 * (1 - slashPhase * 0.35);
      ctx.beginPath();
      ctx.moveTo(-span, 6);
      ctx.quadraticCurveTo(0, -arcLift - 12 * (1 - progress), span, -6);
      ctx.quadraticCurveTo(0, -arcLift + 4, -span, 6);
      ctx.closePath();
      ctx.fillStyle = SAKUGA_PALETTE.bone;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = fx.accent;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Radial speed-line wedges
  if (fx.wedges.length > 0) {
    const wedgeEase = easeOutCubic(Math.min(1, progress / 0.65));
    const wedgeAlpha = Math.max(0, 1 - Math.max(0, progress - 0.18) / 0.65);
    if (wedgeAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = wedgeAlpha;
      for (const w of fx.wedges) {
        const inner = w.innerR + wedgeEase * 24;
        const outer = w.innerR + (w.outerR - w.innerR) * (0.35 + wedgeEase * 0.85);
        ctx.beginPath();
        ctx.moveTo(Math.cos(w.angle - w.spread) * inner, Math.sin(w.angle - w.spread) * inner);
        ctx.lineTo(Math.cos(w.angle) * outer, Math.sin(w.angle) * outer);
        ctx.lineTo(Math.cos(w.angle + w.spread) * inner, Math.sin(w.angle + w.spread) * inner);
        ctx.closePath();
        ctx.fillStyle = w.color;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 4. Hand-drawn anime smoke puffs
  for (const p of fx.puffs) {
    const puffScale = progress < 0.25 ? 0.55 + (progress / 0.25) * 0.55 : 1.1 - (progress - 0.25) * 0.72;
    const puffAlpha = Math.max(0, 1 - Math.pow(progress, 1.55));
    drawSmokePuff(
      ctx,
      p.x,
      p.y,
      Math.max(0, p.radius * puffScale),
      p.rotation,
      p.fill,
      p.stroke,
      puffAlpha
    );
  }

  // 5. Flying sparks, stars, droplets & speed ticks
  for (const s of fx.sparks) {
    const sparkAlpha = Math.max(0, 1 - Math.pow(progress, 1.4));
    const size = s.size * (0.45 + inv * 0.75);
    if (sparkAlpha <= 0.02 || size <= 0.8) continue;

    if (s.shape === "star") {
      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      drawFourPointStar(ctx, s.x, s.y, size * 1.45, size * 0.45, s.rotation, s.color, SAKUGA_PALETTE.ink);
      ctx.restore();
    } else if (s.shape === "diamond") {
      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.3);
      ctx.lineTo(size * 0.7, 0);
      ctx.lineTo(0, size * 1.3);
      ctx.lineTo(-size * 0.7, 0);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = SAKUGA_PALETTE.ink;
      ctx.stroke();
      ctx.restore();
    } else if (s.shape === "drop") {
      const heading = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(heading);
      ctx.beginPath();
      ctx.moveTo(size * 1.5, 0);
      ctx.quadraticCurveTo(0, size * 0.75, -size * 1.1, 0);
      ctx.quadraticCurveTo(0, -size * 0.75, size * 1.5, 0);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = SAKUGA_PALETTE.ink;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.beginPath();
      ctx.moveTo(-size * 1.6, 0);
      ctx.lineTo(size * 1.6, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.strokeStyle = s.color;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 6. Animated checkmark flash for `check` effect (Progress / Toast / Confirm)
  if (fx.kind === "check") {
    const drawT = Math.min(1, progress / 0.32);
    const alpha = Math.max(0, 1 - Math.max(0, progress - 0.45) / 0.55);
    const popScale = progress < 0.25 ? easeOutBack(progress / 0.25) : 1;
    if (alpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, -18 - progress * 10);
      ctx.scale(popScale, popScale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const drawStroke = (width: number, color: string) => {
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        const leg1 = Math.min(1, drawT * 2);
        ctx.lineTo(-16 + 11 * leg1, 11 * leg1);
        if (drawT > 0.5) {
          const leg2 = (drawT - 0.5) * 2;
          ctx.lineTo(-5 + 24 * leg2, 11 - 24 * leg2);
        }
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
      };

      drawStroke(9, SAKUGA_PALETTE.ink);
      drawStroke(5, fx.accent);
      ctx.restore();
    }
  }

  // 7. Bold tilted Manga Sound-Effect (SFX) lettering
  if (fx.sfx) {
    const popIn = Math.min(1, progress / 0.22);
    const sfxScale = easeOutBack(popIn) * (1 - Math.max(0, progress - 0.65) * 0.4);
    const sfxAlpha = progress < 0.62 ? 1 : Math.max(0, 1 - (progress - 0.62) / 0.38);
    if (sfxAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = sfxAlpha;
      const lift = -progress * 20;
      ctx.translate(fx.sfx.offsetX, fx.sfx.offsetY + lift);
      ctx.rotate((fx.sfx.tiltDeg * Math.PI) / 180);
      ctx.scale(sfxScale, sfxScale);

      ctx.font = `900 italic ${fx.sfx.fontSize}px "Archivo", "Hiragino Kaku Gothic ProN", "Yu Gothic", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";

      // Comic offset color shadow
      ctx.fillStyle = fx.sfx.shadow;
      ctx.fillText(fx.sfx.text, 3.5, 3.5);

      // Bold manga ink outline
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = fx.sfx.outline;
      ctx.strokeText(fx.sfx.text, 0, 0);

      // Crisp inner fill
      ctx.fillStyle = fx.sfx.color;
      ctx.fillText(fx.sfx.text, 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ==================== Context & Provider ==================== */

interface SakugaVfxContextValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  reducedMotion: boolean;
  trigger: (kind: SakugaEffectKind, x: number, y: number, options?: SpawnEffectOptions) => void;
  triggerFromElement: (el: Element | null | undefined, kind: SakugaEffectKind, options?: SpawnEffectOptions) => void;
}

const SakugaVfxCtx = createContext<SakugaVfxContextValue>({
  enabled: true,
  setEnabled: () => {},
  reducedMotion: false,
  trigger: () => {},
  triggerFromElement: () => {},
});

export function useSakugaVfx(): SakugaVfxContextValue {
  return useContext(SakugaVfxCtx);
}

export function SakugaVfxProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<SakugaEffect[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const enabledRef = useRef(true);
  const reducedRef = useRef(false);

  enabledRef.current = enabled;
  reducedRef.current = reducedMotion;

  // Hydrate user preference & observe OS prefers-reduced-motion
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "0") setEnabledState(false);
    } catch {
      /* ignore private mode */
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(mq.matches);
    syncMotion();
    mq.addEventListener("change", syncMotion);
    return () => mq.removeEventListener("change", syncMotion);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabledState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!next) {
      effectsRef.current = [];
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.dataset.activeEffects = "0";
      }
    }
  }, []);

  // Keep canvas sized cleanly to viewport * DPR
  useEffect(() => {
    const syncSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncSize();
    window.addEventListener("resize", syncSize, { passive: true });
    return () => window.removeEventListener("resize", syncSize);
  }, []);

  // On-demand render loop — sleeps completely when no effects are alive
  const startLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    lastTsRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(50, Math.max(0, now - lastTsRef.current));
      lastTsRef.current = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = null;
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const next = stepSakugaEffects(effectsRef.current, dt);
      effectsRef.current = next;
      canvas.dataset.activeEffects = String(next.length);

      for (const fx of next) {
        drawEffect(ctx, fx);
      }

      if (next.length > 0) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const spawn = useCallback(
    (kind: SakugaEffectKind, x: number, y: number, options?: SpawnEffectOptions) => {
      if (!enabledRef.current || reducedRef.current) return;
      // Keep max concurrent effects bounded for crisp 60fps even during rapid clicking
      if (effectsRef.current.length >= 16) {
        effectsRef.current = effectsRef.current.slice(-12);
      }
      effectsRef.current = [...effectsRef.current, createSakugaEffect(kind, x, y, options)];
      if (canvasRef.current) {
        canvasRef.current.dataset.activeEffects = String(effectsRef.current.length);
      }
      startLoop();
    },
    [startLoop]
  );

  const triggerFromElement = useCallback(
    (el: Element | null | undefined, kind: SakugaEffectKind, options?: SpawnEffectOptions) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      spawn(kind, rect.left + rect.width / 2, rect.top + rect.height / 2, options);
    },
    [spawn]
  );

  // Subscribe imperative `emitSakuga` calls
  useEffect(() => {
    const onEmit: Listener = (ev) => spawn(ev.kind, ev.x, ev.y, ev.options);
    listeners.add(onEmit);
    return () => {
      listeners.delete(onEmit);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [spawn]);

  // Global site-wide event delegation for native storefront controls
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!enabledRef.current || reducedRef.current) return;
      const rawTarget = event.target;
      if (!(rawTarget instanceof Element)) return;

      // Skip controls that manage their own dedicated Sakuga bursts
      if (rawTarget.closest("[data-sakuga-managed='true']")) return;

      const el = rawTarget.closest(
        "button, a.u-btn, a.u-chip, [role='tab'], [role='switch'], [role='radio'], input[type='checkbox'], input[type='radio']"
      );
      if (!(el instanceof HTMLElement)) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;

      const result = classifySakugaTarget({
        dataSakuga: el.dataset.sakuga,
        tagName: el.tagName,
        role: el.getAttribute("role"),
        inputType: el instanceof HTMLInputElement ? el.type : null,
        classNames: typeof el.className === "string" ? el.className : "",
        ariaLabel: el.getAttribute("aria-label"),
      });

      if (!result) return;

      const rect = el.getBoundingClientRect();
      const x = event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
      const y = event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;

      animateSakugaSpring(el, result.squash);
      spawn(result.kind, x, y, {
        accent: result.accent,
        scale: result.scale,
        label: el.dataset.sakugaLabel,
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [spawn]);

  const ctxValue = useMemo<SakugaVfxContextValue>(
    () => ({
      enabled,
      setEnabled,
      reducedMotion,
      trigger: spawn,
      triggerFromElement,
    }),
    [enabled, setEnabled, reducedMotion, spawn, triggerFromElement]
  );

  return (
    <SakugaVfxCtx.Provider value={ctxValue}>
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-testid="sakuga-vfx-canvas"
        data-vfx-enabled={enabled && !reducedMotion ? "true" : "false"}
        data-active-effects="0"
        className="pointer-events-none fixed inset-0 z-[95] h-dvh w-dvw"
      />
    </SakugaVfxCtx.Provider>
  );
}
