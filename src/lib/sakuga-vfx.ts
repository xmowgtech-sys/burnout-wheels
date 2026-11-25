export type SakugaEffectKind =
  | "impact"
  | "slash"
  | "smoke"
  | "sparkle"
  | "splash"
  | "check"
  | "keyspark";

export interface SakugaPalette {
  ink: string;
  outline: string;
  primary: string;
  ember: string;
  yellow: string;
  mint: string;
  sky: string;
  violet: string;
  rose: string;
  bone: string;
}

export const SAKUGA_PALETTE: SakugaPalette = {
  ink: "#0a0a0c",
  outline: "#f4f4f2",
  primary: "#e10600",
  ember: "#ff2b1a",
  yellow: "#ffe600",
  mint: "#2dd4a0",
  sky: "#7cb8ff",
  violet: "#a78bfa",
  rose: "#ff5d8f",
  bone: "#f4f4f2",
};

export interface SpringState {
  value: number;
  velocity: number;
}

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

/**
 * Semi-implicit Euler 1D spring integrator used for anime squash-and-overshoot
 * physics on controls (sliders, thumbs, tabs, and burst rings).
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dtSec: number,
  config: SpringConfig = { stiffness: 320, damping: 18, mass: 1 }
): SpringState {
  const dt = Math.max(0, Math.min(dtSec, 0.05));
  const mass = Math.max(0.1, config.mass ?? 1);
  const displacement = state.value - target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * state.velocity;
  const accel = (springForce + dampingForce) / mass;
  const velocity = state.velocity + accel * dt;
  const value = state.value + velocity * dt;
  return {
    value: Number.isFinite(value) ? value : target,
    velocity: Number.isFinite(velocity) ? velocity : 0,
  };
}

export interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vr: number;
  fill: string;
  stroke: string;
}

export interface SpeedWedge {
  angle: number;
  innerR: number;
  outerR: number;
  spread: number;
  color: string;
}

export interface SparkShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  color: string;
  shape: "star" | "diamond" | "drop" | "line";
  gravity: number;
}

export interface SfxCallout {
  text: string;
  offsetX: number;
  offsetY: number;
  tiltDeg: number;
  color: string;
  outline: string;
  shadow: string;
  fontSize: number;
}

export interface SakugaEffect {
  id: number;
  kind: SakugaEffectKind;
  x: number;
  y: number;
  age: number; // ms
  duration: number; // ms
  accent: string;
  burstSpikes: number[];
  burstRadius: number;
  slashAngle: number;
  slashRadius: number;
  puffs: SmokePuff[];
  wedges: SpeedWedge[];
  sparks: SparkShard[];
  sfx: SfxCallout | null;
}

export interface SpawnEffectOptions {
  accent?: string;
  label?: string;
  scale?: number;
  seed?: number;
}

const DEFAULT_SFX: Record<SakugaEffectKind, string[]> = {
  impact: ["ドン!", "BOOM!", "GO!"],
  slash: ["シュッ!", "SNAP!"],
  smoke: ["パチッ!", "CLICK!"],
  sparkle: ["キラッ!", "SHINY!"],
  splash: ["ブーン!", "BOOST!"],
  check: ["完了!", "LOCKED!"],
  keyspark: [],
};

/** Deterministic mulberry32 PRNG when seed is provided, else Math.random. */
function makeRng(seed?: number): () => number {
  if (typeof seed !== "number") return Math.random;
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextEffectId = 1;

export function createSakugaEffect(
  kind: SakugaEffectKind,
  x: number,
  y: number,
  options: SpawnEffectOptions = {}
): SakugaEffect {
  const rand = makeRng(options.seed);
  const scale = Math.max(0.5, Math.min(options.scale ?? 1, 2));
  const sfxPool = DEFAULT_SFX[kind];
  const chosenLabel =
    options.label !== undefined
      ? options.label
      : sfxPool.length > 0
        ? sfxPool[Math.floor(rand() * sfxPool.length)]!
        : "";

  const defaultAccent =
    kind === "impact"
      ? SAKUGA_PALETTE.primary
      : kind === "slash"
        ? SAKUGA_PALETTE.sky
        : kind === "smoke"
          ? SAKUGA_PALETTE.mint
          : kind === "sparkle"
            ? SAKUGA_PALETTE.yellow
            : kind === "splash"
              ? SAKUGA_PALETTE.ember
              : kind === "check"
                ? SAKUGA_PALETTE.mint
                : SAKUGA_PALETTE.bone;

  const accent = options.accent || defaultAccent;
  const puffs: SmokePuff[] = [];
  const wedges: SpeedWedge[] = [];
  const sparks: SparkShard[] = [];
  let burstSpikes: number[] = [];
  let burstRadius = 0;
  let slashAngle = -0.42;
  let slashRadius = 0;
  let duration = 560;
  let sfx: SfxCallout | null = null;

  if (kind === "impact") {
    duration = 760;
    burstRadius = 78 * scale;
    const spikeCount = 16;
    burstSpikes = Array.from({ length: spikeCount }, (_, i) =>
      i % 2 === 0 ? 0.86 + rand() * 0.32 : 0.42 + rand() * 0.16
    );
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + (rand() - 0.5) * 0.35;
      const spd = (115 + rand() * 80) * scale;
      puffs.push({
        x: Math.cos(a) * 18 * scale,
        y: Math.sin(a) * 12 * scale,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 14 * scale,
        radius: (13 + rand() * 8) * scale,
        rotation: rand() * Math.PI * 2,
        vr: (rand() - 0.5) * 2.5,
        fill: SAKUGA_PALETTE.bone,
        stroke: SAKUGA_PALETTE.ink,
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + (rand() - 0.5) * 0.25;
      wedges.push({
        angle: a,
        innerR: 28 * scale,
        outerR: (84 + rand() * 34) * scale,
        spread: 0.055 + rand() * 0.03,
        color: i % 2 === 0 ? accent : SAKUGA_PALETTE.yellow,
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2;
      const spd = (180 + rand() * 160) * scale;
      sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 35 * scale,
        size: (5 + rand() * 5) * scale,
        rotation: a,
        vr: (rand() - 0.5) * 9,
        color: i % 3 === 0 ? SAKUGA_PALETTE.yellow : i % 3 === 1 ? accent : SAKUGA_PALETTE.bone,
        shape: i % 2 === 0 ? "diamond" : "star",
        gravity: 280 * scale,
      });
    }
    if (chosenLabel) {
      sfx = {
        text: chosenLabel,
        offsetX: (rand() - 0.5) * 18 * scale,
        offsetY: -46 * scale,
        tiltDeg: -10 + (rand() - 0.5) * 12,
        color: SAKUGA_PALETTE.yellow,
        outline: SAKUGA_PALETTE.ink,
        shadow: accent,
        fontSize: Math.round(32 * scale),
      };
    }
  } else if (kind === "slash") {
    duration = 560;
    slashAngle = -0.35 + (rand() - 0.5) * 0.4;
    slashRadius = 68 * scale;
    for (let i = 0; i < 6; i++) {
      const a = slashAngle + (rand() - 0.5) * 0.9;
      const spd = (150 + rand() * 120) * scale;
      sparks.push({
        x: (rand() - 0.5) * 24 * scale,
        y: (rand() - 0.5) * 14 * scale,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: (6 + rand() * 5) * scale,
        rotation: a,
        vr: (rand() - 0.5) * 6,
        color: i % 2 === 0 ? accent : SAKUGA_PALETTE.bone,
        shape: "line",
        gravity: 60 * scale,
      });
    }
    if (chosenLabel) {
      sfx = {
        text: chosenLabel,
        offsetX: 28 * scale,
        offsetY: -28 * scale,
        tiltDeg: -14,
        color: SAKUGA_PALETTE.bone,
        outline: SAKUGA_PALETTE.ink,
        shadow: accent,
        fontSize: Math.round(20 * scale),
      };
    }
  } else if (kind === "smoke") {
    duration = 520;
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + (rand() - 0.5) * 0.4;
      const spd = (68 + rand() * 65) * scale;
      puffs.push({
        x: Math.cos(a) * 8 * scale,
        y: Math.sin(a) * 6 * scale,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 26 * scale,
        radius: (10 + rand() * 7) * scale,
        rotation: rand() * Math.PI * 2,
        vr: (rand() - 0.5) * 2.2,
        fill: i % 2 === 0 ? SAKUGA_PALETTE.bone : accent,
        stroke: SAKUGA_PALETTE.ink,
      });
    }
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      wedges.push({
        angle: a,
        innerR: 16 * scale,
        outerR: (42 + rand() * 14) * scale,
        spread: 0.05,
        color: accent,
      });
    }
    if (chosenLabel) {
      sfx = {
        text: chosenLabel,
        offsetX: (rand() - 0.5) * 14 * scale,
        offsetY: -34 * scale,
        tiltDeg: 8 - rand() * 16,
        color: SAKUGA_PALETTE.bone,
        outline: SAKUGA_PALETTE.ink,
        shadow: accent,
        fontSize: Math.round(21 * scale),
      };
    }
  } else if (kind === "sparkle") {
    duration = 620;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 + (rand() - 0.5) * 0.35;
      const spd = (90 + rand() * 125) * scale;
      sparks.push({
        x: Math.cos(a) * 6 * scale,
        y: Math.sin(a) * 6 * scale,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40 * scale,
        size: (6 + rand() * 7) * scale,
        rotation: rand() * Math.PI,
        vr: (rand() - 0.5) * 7,
        color: i % 3 === 0 ? SAKUGA_PALETTE.yellow : i % 3 === 1 ? accent : SAKUGA_PALETTE.bone,
        shape: "star",
        gravity: 110 * scale,
      });
    }
    if (chosenLabel) {
      sfx = {
        text: chosenLabel,
        offsetX: 0,
        offsetY: -38 * scale,
        tiltDeg: -7,
        color: SAKUGA_PALETTE.yellow,
        outline: SAKUGA_PALETTE.ink,
        shadow: accent,
        fontSize: Math.round(22 * scale),
      };
    }
  } else if (kind === "splash") {
    duration = 520;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.85 + (Math.PI * 0.7 * i) / 9 + (rand() - 0.5) * 0.2;
      const spd = (120 + rand() * 130) * scale;
      sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 35 * scale,
        size: (5 + rand() * 5) * scale,
        rotation: a,
        vr: 0,
        color: i % 2 === 0 ? accent : SAKUGA_PALETTE.yellow,
        shape: "drop",
        gravity: 420 * scale,
      });
    }
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI * 0.8 + (Math.PI * 0.6 * i) / 3;
      wedges.push({
        angle: a,
        innerR: 18 * scale,
        outerR: (48 + rand() * 18) * scale,
        spread: 0.055,
        color: accent,
      });
    }
    if (chosenLabel) {
      sfx = {
        text: chosenLabel,
        offsetX: 0,
        offsetY: -38 * scale,
        tiltDeg: -9,
        color: SAKUGA_PALETTE.bone,
        outline: SAKUGA_PALETTE.ink,
        shadow: accent,
        fontSize: Math.round(21 * scale),
      };
    }
  } else if (kind === "check") {
    duration = 680;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      wedges.push({
        angle: a,
        innerR: 24 * scale,
        outerR: 54 * scale,
        spread: 0.045,
        color: i % 2 === 0 ? accent : SAKUGA_PALETTE.yellow,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      const spd = (95 + rand() * 90) * scale;
      sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30 * scale,
        size: (5 + rand() * 5) * scale,
        rotation: rand() * Math.PI,
        vr: (rand() - 0.5) * 6,
        color: i % 2 === 0 ? SAKUGA_PALETTE.yellow : accent,
        shape: "star",
        gravity: 140 * scale,
      });
    }
    if (chosenLabel) {
      sfx = {
        text: chosenLabel,
        offsetX: 34 * scale,
        offsetY: -32 * scale,
        tiltDeg: -8,
        color: SAKUGA_PALETTE.mint,
        outline: SAKUGA_PALETTE.ink,
        shadow: SAKUGA_PALETTE.ink,
        fontSize: Math.round(20 * scale),
      };
    }
  } else {
    // keyspark — subtle crisp ink sparks for inputs
    duration = 320;
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI * 0.9 + rand() * Math.PI * 0.8;
      const spd = (75 + rand() * 75) * scale;
      sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20 * scale,
        size: (3.5 + rand() * 3) * scale,
        rotation: a,
        vr: (rand() - 0.5) * 8,
        color: i % 2 === 0 ? SAKUGA_PALETTE.yellow : SAKUGA_PALETTE.primary,
        shape: "diamond",
        gravity: 220 * scale,
      });
    }
  }

  return {
    id: nextEffectId++,
    kind,
    x,
    y,
    age: 0,
    duration,
    accent,
    burstSpikes,
    burstRadius,
    slashAngle,
    slashRadius,
    puffs,
    wedges,
    sparks,
    sfx,
  };
}

/**
 * Advances all active Sakuga effects by `dtMs` and prunes expired ones.
 * Pure & deterministic so it can be verified without a browser canvas.
 */
export function stepSakugaEffects(effects: SakugaEffect[], dtMs: number): SakugaEffect[] {
  const clampedDt = Math.max(0, Math.min(dtMs, 64));
  const dtSec = clampedDt / 1000;
  const drag = Math.pow(0.08, dtSec);
  const next: SakugaEffect[] = [];

  for (const fx of effects) {
    const age = fx.age + clampedDt;
    if (age >= fx.duration) continue;

    const puffs = fx.puffs.map((p) => ({
      ...p,
      x: p.x + p.vx * dtSec,
      y: p.y + p.vy * dtSec,
      vx: p.vx * drag,
      vy: p.vy * drag - 10 * dtSec,
      rotation: p.rotation + p.vr * dtSec,
    }));

    const sparks = fx.sparks.map((s) => ({
      ...s,
      x: s.x + s.vx * dtSec,
      y: s.y + s.vy * dtSec,
      vx: s.vx * Math.pow(0.25, dtSec),
      vy: s.vy + s.gravity * dtSec,
      rotation: s.rotation + s.vr * dtSec,
    }));

    next.push({
      ...fx,
      age,
      puffs,
      sparks,
    });
  }

  return next;
}

export interface TargetClassificationInput {
  dataSakuga?: string | null;
  tagName: string;
  role?: string | null;
  inputType?: string | null;
  classNames?: string;
  ariaLabel?: string | null;
}

export interface TargetClassificationResult {
  kind: SakugaEffectKind;
  accent?: string;
  scale?: number;
  squash: "heavy" | "snappy" | "pop";
}

const VALID_KINDS = new Set<SakugaEffectKind>([
  "impact",
  "slash",
  "smoke",
  "sparkle",
  "splash",
  "check",
  "keyspark",
]);

/**
 * Maps an interactive DOM element's semantics/classes to the matching Sakuga
 * anime VFX preset and spring squash profile. Returns `null` when suppressed
 * (`data-sakuga="off"`) or not an eligible control.
 */
export function classifySakugaTarget(
  input: TargetClassificationInput
): TargetClassificationResult | null {
  const explicit = input.dataSakuga?.trim().toLowerCase();
  if (explicit === "off" || explicit === "none") return null;
  if (explicit && VALID_KINDS.has(explicit as SakugaEffectKind)) {
    const kind = explicit as SakugaEffectKind;
    return {
      kind,
      squash: kind === "impact" ? "heavy" : kind === "sparkle" || kind === "smoke" ? "pop" : "snappy",
    };
  }

  const cls = input.classNames ?? "";
  const tag = input.tagName.toUpperCase();
  const role = (input.role ?? "").toLowerCase();
  const type = (input.inputType ?? "").toLowerCase();
  const aria = (input.ariaLabel ?? "").toLowerCase();

  if (aria.includes("wishlist") || aria.includes("star")) {
    return { kind: "sparkle", accent: SAKUGA_PALETTE.rose, scale: 0.9, squash: "pop" };
  }
  if (cls.includes("u-btn-primary") || cls.includes("u-btn-danger")) {
    return { kind: "impact", accent: SAKUGA_PALETTE.primary, scale: 1, squash: "heavy" };
  }
  if (cls.includes("u-btn-ghost") || cls.includes("u-btn-secondary") || cls.includes("u-btn-redline")) {
    return { kind: "slash", accent: SAKUGA_PALETTE.sky, scale: 0.92, squash: "snappy" };
  }
  if (cls.includes("u-chip") || role === "tab") {
    return { kind: "slash", accent: SAKUGA_PALETTE.primary, scale: 0.85, squash: "snappy" };
  }
  if (role === "switch" || (tag === "INPUT" && (type === "checkbox" || type === "radio")) || role === "radio") {
    return { kind: "smoke", accent: SAKUGA_PALETTE.mint, scale: 0.85, squash: "pop" };
  }
  if (tag === "BUTTON" && !aria.includes("close")) {
    return { kind: "slash", accent: SAKUGA_PALETTE.primary, scale: 0.78, squash: "snappy" };
  }

  return null;
}
