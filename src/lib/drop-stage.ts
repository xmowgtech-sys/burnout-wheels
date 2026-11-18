export type CameraPresetId = "hero" | "aero" | "top" | "diffuser";

export interface CameraPresetSpec {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPresetSpec> = {
  hero: {
    id: "hero",
    label: "3/4 Hero",
    position: [4.25, 1.75, 4.65],
    lookAt: [0, 0.34, 0],
    fov: 37,
  },
  aero: {
    id: "aero",
    label: "Front Aero",
    position: [1.35, 1.15, 5.15],
    lookAt: [0, 0.32, 0.35],
    fov: 35,
  },
  top: {
    id: "top",
    label: "Top Down",
    position: [0.05, 5.6, 1.1],
    lookAt: [0, 0.2, 0],
    fov: 36,
  },
  diffuser: {
    id: "diffuser",
    label: "Rear Wing",
    position: [-3.95, 1.58, -4.45],
    lookAt: [0, 0.42, -0.25],
    fov: 37,
  },
};

export type PdpOrbitAngleId = "hero" | "front" | "side" | "rear" | "top" | "cockpit";

export interface PdpOrbitPresetSpec {
  id: PdpOrbitAngleId;
  label: string;
  azimuthDeg: number;
  polarDeg: number;
  distance: number;
  targetY: number;
}

export const PDP_ORBIT_PRESETS: Record<PdpOrbitAngleId, PdpOrbitPresetSpec> = {
  hero: {
    id: "hero",
    label: "3/4 Front",
    azimuthDeg: 38,
    polarDeg: 69,
    distance: 5.55,
    targetY: 0.34,
  },
  front: {
    id: "front",
    label: "Nose & Wing",
    azimuthDeg: 0,
    polarDeg: 78,
    distance: 5.15,
    targetY: 0.34,
  },
  side: {
    id: "side",
    label: "Side Profile",
    azimuthDeg: 90,
    polarDeg: 82,
    distance: 5.95,
    targetY: 0.34,
  },
  rear: {
    id: "rear",
    label: "Rear Diffuser",
    azimuthDeg: 196,
    polarDeg: 74,
    distance: 5.3,
    targetY: 0.38,
  },
  top: {
    id: "top",
    label: "Top Aero",
    azimuthDeg: 0,
    polarDeg: 14,
    distance: 6.1,
    targetY: 0.25,
  },
  cockpit: {
    id: "cockpit",
    label: "Cockpit Halo",
    azimuthDeg: 322,
    polarDeg: 48,
    distance: 3.45,
    targetY: 0.56,
  },
};

export const PDP_ORBIT_MIN_POLAR_RAD = 0.16;
export const PDP_ORBIT_MAX_POLAR_RAD = 1.46;
export const PDP_ORBIT_MIN_DISTANCE = 2.85;
export const PDP_ORBIT_MAX_DISTANCE = 8.4;

export function normalizeAzimuthDegrees(azimuthRad: number): number {
  if (!Number.isFinite(azimuthRad)) return 0;
  const deg = (azimuthRad * 180) / Math.PI;
  const wrapped = ((deg % 360) + 360) % 360;
  const rounded = Math.round(wrapped);
  return rounded === 360 ? 0 : rounded;
}

export function clampOrbitPitch(polarRad: number): number {
  if (!Number.isFinite(polarRad)) return 1.15;
  return Math.min(PDP_ORBIT_MAX_POLAR_RAD, Math.max(PDP_ORBIT_MIN_POLAR_RAD, polarRad));
}

export function clampOrbitDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 5.55;
  return Math.min(PDP_ORBIT_MAX_DISTANCE, Math.max(PDP_ORBIT_MIN_DISTANCE, distance));
}

export function sphericalToCartesian(
  azimuthRad: number,
  polarRad: number,
  distance: number,
  targetY = 0.34
): [number, number, number] {
  const phi = clampOrbitPitch(polarRad);
  const d = clampOrbitDistance(distance);
  const sinPhi = Math.sin(phi);
  return [
    d * sinPhi * Math.sin(azimuthRad),
    targetY + d * Math.cos(phi),
    d * sinPhi * Math.cos(azimuthRad),
  ];
}

export interface DropLiveryProfile {
  key: string;
  teamLabel: string;
  chassisCode: string;
  carNumber: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  sidewallHex: string;
  visorHex: string;
  finish: "gloss" | "satin" | "metallic";
}

const LIVERY_PROFILES: Record<string, DropLiveryProfile> = {
  redbull: {
    key: "redbull",
    teamLabel: "Oracle Red Bull Racing",
    chassisCode: "RB20 · HON-RBPT",
    carNumber: "1",
    primaryHex: "#101b3d",
    secondaryHex: "#0b1124",
    accentHex: "#e10600",
    sidewallHex: "#e10600",
    visorHex: "#ffae00",
    finish: "satin",
  },
  ferrari: {
    key: "ferrari",
    teamLabel: "Maranello Rosso Corsa",
    chassisCode: "SF · MARANELLO",
    carNumber: "16",
    primaryHex: "#c90c0c",
    secondaryHex: "#16171b",
    accentHex: "#ffe600",
    sidewallHex: "#e10600",
    visorHex: "#ff4800",
    finish: "gloss",
  },
  mercedes: {
    key: "mercedes",
    teamLabel: "Mercedes-AMG Petronas",
    chassisCode: "W15 · PETRONAS",
    carNumber: "63",
    primaryHex: "#13161b",
    secondaryHex: "#8d96a0",
    accentHex: "#00d2be",
    sidewallHex: "#00d2be",
    visorHex: "#2dd4a0",
    finish: "metallic",
  },
  haas: {
    key: "haas",
    teamLabel: "MoneyGram Haas F1",
    chassisCode: "VF-24 · FERRARI PU",
    carNumber: "27",
    primaryHex: "#181a1f",
    secondaryHex: "#ebebea",
    accentHex: "#e10600",
    sidewallHex: "#ffe600",
    visorHex: "#e10600",
    finish: "satin",
  },
  williams: {
    key: "williams",
    teamLabel: "Williams Racing Gulf",
    chassisCode: "FW46 · GROVE",
    carNumber: "23",
    primaryHex: "#0b4ea2",
    secondaryHex: "#38bdf8",
    accentHex: "#ff6b1a",
    sidewallHex: "#38bdf8",
    visorHex: "#7cb8ff",
    finish: "gloss",
  },
  mclaren: {
    key: "mclaren",
    teamLabel: "McLaren F1 Team",
    chassisCode: "MCL38 · PAPAYA",
    carNumber: "4",
    primaryHex: "#ff7300",
    secondaryHex: "#14161a",
    accentHex: "#00a8e8",
    sidewallHex: "#ff7300",
    visorHex: "#38bdf8",
    finish: "gloss",
  },
  burnout: {
    key: "burnout",
    teamLabel: "Burnout Pit Spec",
    chassisCode: "BW · PADDOCK 001",
    carNumber: "01",
    primaryHex: "#d60e08",
    secondaryHex: "#15171c",
    accentHex: "#ffe600",
    sidewallHex: "#e10600",
    visorHex: "#ff7a1a",
    finish: "metallic",
  },
};

export function resolveDropLivery(product?: {
  slug?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  tags?: string[] | null;
} | null): DropLiveryProfile {
  if (!product) return LIVERY_PROFILES.burnout;
  const hay = [
    product.slug ?? "",
    product.name ?? "",
    product.brand ?? "",
    product.category ?? "",
    ...(product.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (hay.includes("red bull") || hay.includes("red-bull") || hay.includes("rb20")) {
    return LIVERY_PROFILES.redbull;
  }
  if (hay.includes("mercedes") || hay.includes("petronas") || hay.includes("hamilton")) {
    return LIVERY_PROFILES.mercedes;
  }
  if (hay.includes("haas") || hay.includes("moneygram") || hay.includes("vf-24")) {
    return LIVERY_PROFILES.haas;
  }
  if (hay.includes("williams") || hay.includes("fw46") || hay.includes("gulf")) {
    return LIVERY_PROFILES.williams;
  }
  if (hay.includes("mclaren") || hay.includes("papaya") || hay.includes("norris")) {
    return LIVERY_PROFILES.mclaren;
  }
  if (hay.includes("ferrari") || hay.includes("sf90") || hay.includes("12cilindri") || hay.includes("365") || hay.includes("f50")) {
    return LIVERY_PROFILES.ferrari;
  }
  return LIVERY_PROFILES.burnout;
}

export type StudioLightingMode = "paddock" | "daylight" | "windtunnel";

export interface HeroDropChapterSpec {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  specLabel: string;
  specValue: string;
  preset: CameraPresetId;
}

export const HERO_DROP_CHAPTERS: HeroDropChapterSpec[] = [
  {
    id: 0,
    code: "01 // AERO ENTRY",
    title: "Four-Element Wing & #1 Nosecone",
    subtitle: "Gull-wing carbon mainplane integrated flush onto the championship #1 RB20 nose tip and pull-rod front suspension.",
    specLabel: "Front Downforce",
    specValue: "Pull-Rod · 4-Plane CF",
    preset: "hero",
  },
  {
    id: 1,
    code: "02 // CANNON DECK",
    title: "Overbite Sidepods & Cannon Spine",
    subtitle: "Signature letterbox cooling intakes, deep floor undercut canyon, Oracle satin livery, and sculpted rear cooling channels.",
    specLabel: "Power Unit",
    specValue: "Honda RBPT V6 Turbo",
    preset: "aero",
  },
  {
    id: 2,
    code: "03 // VENTURI TUNNEL",
    title: "Pirelli P-Zero & 5-Strake Diffuser",
    subtitle: "18-inch vulcanized slicks with P-Zero crimson sidewall graphics, swan-neck DRS actuator wing, and dual exhaust waist.",
    specLabel: "Compound Spec",
    specValue: "P Zero Soft · C5",
    preset: "diffuser",
  },
  {
    id: 3,
    code: "04 // PIT LAUNCH",
    title: "Entering Pit Lane Grid",
    subtitle: "Drop 001 telemetry locked — transitioning smoothly from 3D scrutineering turntable to paddock inspection.",
    specLabel: "Stage Status",
    specValue: "Clearance Confirmed",
    preset: "top",
  },
];

export interface HeroDropShowcaseState {
  clampedProgress: number;
  chapterIndex: number;
  targetYaw: number;
  aeroPitch: number;
  recommendedPreset: CameraPresetId;
  exitProgress: number;
  carLaunchZ: number;
  wheelSpeedMultiplier: number;
  stageOpacity: number;
  stageScale: number;
}

export function computeHeroDropShowcaseState(scrollRatio: number): HeroDropShowcaseState {
  const clampedProgress = Number.isFinite(scrollRatio) ? Math.min(1, Math.max(0, scrollRatio)) : 0;

  let chapterIndex = 0;
  if (clampedProgress >= 0.76) chapterIndex = 3;
  else if (clampedProgress >= 0.50) chapterIndex = 2;
  else if (clampedProgress >= 0.24) chapterIndex = 1;

  // Main inspection spin happens across [0 .. 0.76], then car locks forward-angled for exit launch
  const spinFrac = Math.min(1, clampedProgress / 0.76);
  const rawExit = clampedProgress <= 0.76 ? 0 : (clampedProgress - 0.76) / 0.24;
  const exitProgress = rawExit * rawExit * (3 - 2 * rawExit);

  const targetYaw = BASE_HERO_YAW + spinFrac * Math.PI * 2.0 + exitProgress * 0.42;
  const aeroPitch = Math.sin(clampedProgress * Math.PI * 2) * 0.012 - exitProgress * 0.032;
  const recommendedPreset = HERO_DROP_CHAPTERS[chapterIndex]?.preset ?? "hero";

  return {
    clampedProgress,
    chapterIndex,
    targetYaw,
    aeroPitch,
    recommendedPreset,
    exitProgress,
    carLaunchZ: Math.pow(exitProgress, 2.1) * 7.8,
    wheelSpeedMultiplier: 1 + exitProgress * 9.5,
    stageOpacity: Math.max(0, 1 - Math.pow(exitProgress, 1.45)),
    stageScale: 1 - exitProgress * 0.14,
  };
}

export interface ScrollDropState {
  clampedProgress: number;
  activeIndex: number;
  segmentProgress: number;
  /** Target yaw in radians — sweeps multi-turn 360deg rotations cleanly through drops. */
  targetYaw: number;
  /** Subtle chassis breathing pitch for aerodynamic attitude. */
  aeroPitch: number;
  /** Normalized stage camera preset recommendation for editorial flow. */
  recommendedPreset: CameraPresetId;
}

const BASE_HERO_YAW = 0.58; // ~33deg classic front 3/4 view

export function computeScrollDropProgress(scrollRatio: number, dropCount: number): ScrollDropState {
  const safeCount = Math.max(1, Math.floor(dropCount));
  const clampedProgress = Number.isFinite(scrollRatio) ? Math.min(1, Math.max(0, scrollRatio)) : 0;

  if (safeCount === 1) {
    return {
      clampedProgress,
      activeIndex: 0,
      segmentProgress: clampedProgress,
      targetYaw: BASE_HERO_YAW + clampedProgress * Math.PI * 2,
      aeroPitch: Math.sin(clampedProgress * Math.PI) * 0.015,
      recommendedPreset: "hero",
    };
  }

  const scaled = clampedProgress * (safeCount - 1);
  const activeIndex = Math.min(safeCount - 1, Math.floor(scaled + 0.32));
  const localFloor = Math.min(safeCount - 2, Math.floor(scaled));
  const segmentProgress = Math.min(1, Math.max(0, scaled - localFloor));

  // Complete 180deg-240deg sweep per drop transition so scrolling noticeably spins the F1 car cleanly.
  const totalSweepRadians = Math.max(Math.PI * 2, (safeCount - 1) * Math.PI * 1.15);
  const targetYaw = BASE_HERO_YAW + clampedProgress * totalSweepRadians;
  const aeroPitch = Math.sin(clampedProgress * Math.PI * safeCount) * 0.012;

  const presetCycle: CameraPresetId[] = ["hero", "aero", "hero", "diffuser"];
  const recommendedPreset = presetCycle[activeIndex % presetCycle.length]!;

  return {
    clampedProgress,
    activeIndex,
    segmentProgress,
    targetYaw,
    aeroPitch,
    recommendedPreset,
  };
}

export interface CheckoutLineInput {
  price: number;
  qty: number;
}

export interface CheckoutPricingResult {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  shippingFee: number;
  total: number;
  freeShippingUnlocked: boolean;
}

export function computeCheckoutPricing(input: {
  items: CheckoutLineInput[];
  shippingMethod: "STANDARD" | "EXPRESS";
  discountAmount?: number;
  freeOverPaise?: number;
  standardFeePaise?: number;
  expressFeePaise?: number;
}): CheckoutPricingResult {
  const subtotal = input.items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.price)) * Math.max(0, Math.floor(item.qty)),
    0
  );
  const discount = Math.min(subtotal, Math.max(0, Math.round(input.discountAmount ?? 0)));
  const discountedSubtotal = subtotal - discount;
  const freeOver = input.freeOverPaise ?? 249900;
  const standardFee = input.standardFeePaise ?? 9900;
  const expressFee = input.expressFeePaise ?? 19900;

  const freeShippingUnlocked = discountedSubtotal >= freeOver && subtotal > 0;
  const shippingFee = subtotal === 0 || freeShippingUnlocked ? 0 : input.shippingMethod === "EXPRESS" ? expressFee : standardFee;
  const total = discountedSubtotal + shippingFee;

  return {
    subtotal,
    discount,
    discountedSubtotal,
    shippingFee,
    total,
    freeShippingUnlocked,
  };
}
