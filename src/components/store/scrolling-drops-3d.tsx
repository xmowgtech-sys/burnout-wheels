"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Eye,
  EyeOff,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sun,
  Wind,
} from "lucide-react";
import {
  CAMERA_PRESETS,
  HERO_DROP_CHAPTERS,
  computeHeroDropShowcaseState,
  resolveDropLivery,
  type CameraPresetId,
  type StudioLightingMode,
} from "@/lib/drop-stage";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS, RARITY_LABELS, type Product } from "@/lib/types";
import { cn, dropLabel } from "@/lib/utils";
import { F1ShowroomCanvas } from "./f1-showroom-canvas";
import { useStore, useToast } from "./providers";
import { scrollToTarget } from "./smooth-scroll";

const PRESET_LIST: CameraPresetId[] = ["hero", "aero", "top", "diffuser"];
const CHAPTER_SCROLL_TARGETS = [0.06, 0.34, 0.62, 0.84] as const;

const STUDIO_MODES: Array<{
  id: StudioLightingMode;
  label: string;
  shortLabel: string;
  icon: typeof Moon;
}> = [
  { id: "paddock", label: "Night Paddock", shortLabel: "Paddock", icon: Moon },
  { id: "daylight", label: "Silverstone Light", shortLabel: "Daylight", icon: Sun },
  { id: "windtunnel", label: "CFD Wind Tunnel", shortLabel: "Tunnel", icon: Wind },
];

/**
 * Single-#1 Drop Photorealistic RB20 3D Showcase with synchronized telemetry chapters,
 * interactive 3-rig studio lighting, and a Max-Pro scroll-away pit launch transition.
 */
export function ScrollingDrops3D({ product }: { product: Product | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const store = useStore();
  const { toast } = useToast();

  const [scrollState, setScrollState] = useState(() => computeHeroDropShowcaseState(0));
  const [manualPreset, setManualPreset] = useState<CameraPresetId | null>(null);
  const [studioMode, setStudioMode] = useState<StudioLightingMode>("paddock");
  const [autoSpin, setAutoSpin] = useState(true);
  const [hudHidden, setHudHidden] = useState(false);

  // Measure continuous scroll progress along the 310vh runway without fighting Lenis
  useEffect(() => {
    if (!product) return;
    let raf = 0;

    const measure = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
      const raw = -rect.top / scrollable;
      const next = computeHeroDropShowcaseState(raw);

      setScrollState((prev) => {
        if (
          Math.abs(prev.clampedProgress - next.clampedProgress) < 0.0015 &&
          prev.chapterIndex === next.chapterIndex
        ) {
          return prev;
        }
        return next;
      });
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const lenis = window.__bwLenis;
    lenis?.on("scroll", onScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      lenis?.off("scroll", onScroll);
    };
  }, [product]);

  // Keyboard shortcut 'H' to toggle HUD cleanly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "h" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
      ) {
        setHudHidden((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const jumpToChapter = useCallback((idx: number) => {
    setManualPreset(null);
    const el = sectionRef.current;
    if (!el) return;
    const sectionTop = window.scrollY + el.getBoundingClientRect().top;
    const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
    const ratio = CHAPTER_SCROLL_TARGETS[idx] ?? 0.06;
    scrollToTarget(Math.round(sectionTop + ratio * scrollable), 0);
  }, []);

  if (!product) return null;

  const livery = resolveDropLivery(product);
  const activeChapter = HERO_DROP_CHAPTERS[scrollState.chapterIndex] ?? HERO_DROP_CHAPTERS[0]!;
  const effectivePreset = manualPreset ?? scrollState.recommendedPreset;
  const soldOut = product.stock <= 0;

  const addHeroToCart = () => {
    if (soldOut) return;
    store.add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.priceSale,
      image: product.images[0] ?? null,
      condition: CONDITION_LABELS[product.condition],
      stock: product.stock,
    });
    toast(`${product.name} loaded into cart`);
  };

  const exitProgress = scrollState.exitProgress;

  return (
    <section
      ref={sectionRef}
      id="drops-stage"
      data-testid="scrolling-drops-3d"
      data-active-drop={product.slug}
      data-active-chapter={activeChapter.id}
      data-exit-progress={exitProgress.toFixed(2)}
      data-studio-mode={studioMode}
      className="relative h-[285vh] overflow-x-clip border-t border-line bg-[#090a0c] md:h-[310vh]"
      aria-label="Drop 001 Interactive 3D RB20 Studio"
    >
      {/* Full-Viewport Sticky Showcase Runway */}
      <div className="sticky top-16 z-20 h-[calc(100svh-64px)] w-full overflow-hidden bg-[#090a0c] md:top-[72px] md:h-[calc(100svh-72px)]">
        {/* Scroll-Driven Max-Pro Launch Exit Transform Layer (GPU-composited scale + opacity + lift) */}
        <div
          data-testid="f1-exit-stage"
          className="relative h-full w-full will-change-transform"
          style={{
            opacity: scrollState.stageOpacity,
            transform: `translate3d(0, ${-exitProgress * 36}px, 0) scale(${scrollState.stageScale})`,
          }}
        >
          <F1ShowroomCanvas
            scrollProgress={scrollState.clampedProgress}
            targetYaw={scrollState.targetYaw}
            aeroPitch={scrollState.aeroPitch}
            livery={livery}
            preset={effectivePreset}
            autoSpin={autoSpin && exitProgress < 0.05}
            studioMode={studioMode}
            carLaunchZ={scrollState.carLaunchZ}
            wheelSpeedMultiplier={scrollState.wheelSpeedMultiplier}
            fallbackImage={product.images[0] ?? null}
            fallbackTitle={product.name}
          />

          {/* Top Edge Framing: Drop 001 Editorial Telemetry & 3-Mode Studio Lighting Switcher */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto max-w-[1500px] px-4 pt-3.5 sm:px-6 md:px-8 md:pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 max-w-lg">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="h-2 w-2 bg-red" aria-hidden />
                  <p className="u-mono text-[10px] uppercase tracking-[0.22em] text-red">
                    {dropLabel(product.dropNumber, product.id)} // Flagship #1 Drop
                  </p>
                  <span className="hidden h-3 w-px bg-line sm:inline-block" aria-hidden />
                  <p className="u-mono hidden text-[10px] uppercase tracking-[0.18em] text-fog sm:block">
                    {livery.chassisCode}
                  </p>
                </div>
                <h2 className="mt-1 truncate text-base font-extrabold uppercase tracking-tight text-bone sm:text-2xl md:mt-1.5 md:text-[28px]">
                  {product.name}
                </h2>
                <p className="mt-0.5 hidden text-[12.5px] leading-snug text-fog md:block">
                  <span className="font-semibold text-bone">{activeChapter.code}:</span> {activeChapter.subtitle}
                </p>
              </div>

              {/* 3-Mode Lighting Rig Selector — solid backed, crisp tactile switching */}
              <div
                className="pointer-events-auto flex shrink-0 items-center border border-line-strong bg-[#0c0e13]/95 p-1"
                role="group"
                aria-label="3D Studio Lighting Mode"
              >
                {STUDIO_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const active = studioMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      data-testid={`studio-mode-${mode.id}`}
                      aria-pressed={active}
                      onClick={() => setStudioMode(mode.id)}
                      className={cn(
                        "flex min-h-8 items-center gap-1.5 px-2.5 py-1 u-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                        active
                          ? "bg-red text-white"
                          : "text-fog hover:bg-white/5 hover:text-bone"
                      )}
                      title={mode.label}
                    >
                      <Icon className="size-3" aria-hidden />
                      <span className="hidden sm:inline">{mode.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Telemetry Chapters directly below header on Mobile & Tablet */}
            {!hudHidden && (
              <div
                className="pointer-events-auto mt-2.5 flex w-full items-center gap-1 overflow-x-auto border border-line bg-[#0c0e13]/95 p-1 lg:hidden"
                role="tablist"
                aria-label="RB20 telemetry inspection chapters"
              >
                {HERO_DROP_CHAPTERS.map((ch, idx) => {
                  const isActive = idx === scrollState.chapterIndex;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => jumpToChapter(idx)}
                      className={cn(
                        "min-h-8 shrink-0 px-2.5 py-1 u-mono text-[9.5px] uppercase tracking-[0.12em] transition-colors",
                        isActive ? "bg-red text-white" : "text-fog hover:text-bone"
                      )}
                    >
                      {String(idx + 1).padStart(2, "0")} · {CAMERA_PRESETS[ch.preset].label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Left Desktop Vertical Telemetry Rail (Chapters 01 -> 04) */}
          {!hudHidden && (
            <nav
              aria-label="RB20 telemetry inspection chapters"
              className="pointer-events-auto absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-1.5 md:left-8 lg:flex"
            >
              {HERO_DROP_CHAPTERS.map((ch, idx) => {
                const isActive = idx === scrollState.chapterIndex;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    data-testid={`drop-chapter-${idx}`}
                    onClick={() => jumpToChapter(idx)}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "group relative flex w-64 flex-col items-start border px-3.5 py-2.5 text-left transition-colors",
                      isActive
                        ? "border-red bg-[#0c0e13]/95 text-bone"
                        : "border-line bg-[#0a0c10]/90 text-fog hover:border-line-strong hover:text-bone"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className={cn(
                          "whitespace-nowrap u-mono text-[9.5px] uppercase tracking-[0.16em]",
                          isActive ? "text-red" : "text-dim"
                        )}
                      >
                        {ch.code}
                      </span>
                      <span className="whitespace-nowrap u-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                        {CAMERA_PRESETS[ch.preset].label}
                      </span>
                    </div>
                    <span className="mt-1 text-[12px] font-bold uppercase tracking-tight">
                      {ch.title}
                    </span>
                    {isActive && (
                      <span className="u-mono mt-1 text-[10px] text-mint">
                        {ch.specLabel}: {ch.specValue}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Bottom Edge Dock — lifted cleanly above bottom consent bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[106px] z-10 mx-auto flex max-w-[1500px] flex-col gap-2 px-3 sm:bottom-[72px] sm:px-6 md:flex-row md:flex-wrap md:items-end md:justify-between md:px-8">
            {/* Left/Center Camera & Spin HUD (Desktop & Tablet) */}
            <div className="pointer-events-auto hidden items-center justify-between gap-2 md:flex md:justify-start">
              {hudHidden ? (
                <button
                  type="button"
                  onClick={() => setHudHidden(false)}
                  className="flex min-h-10 items-center gap-2 border border-line-strong bg-[#0c0e13]/95 px-3.5 py-2 u-mono text-[10px] uppercase tracking-[0.16em] text-bone transition-colors hover:border-red"
                >
                  <Eye className="size-3.5 text-red" aria-hidden />
                  Show HUD (H)
                </button>
              ) : (
                <div
                  data-testid="f1-hud-dock"
                  className="flex max-w-full flex-wrap items-center gap-1 border border-line-strong bg-[#0c0e13]/95 p-1"
                >
                  {PRESET_LIST.map((pid) => (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setManualPreset(pid)}
                      className={cn(
                        "min-h-8 px-2 py-1 u-mono text-[9.5px] uppercase tracking-[0.14em] transition-colors sm:min-h-9 sm:px-2.5 sm:text-[10px]",
                        effectivePreset === pid
                          ? "bg-red text-white"
                          : "text-fog hover:bg-white/5 hover:text-bone"
                      )}
                    >
                      {CAMERA_PRESETS[pid].label}
                    </button>
                  ))}
                  <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setAutoSpin((v) => !v)}
                    className="flex min-h-8 items-center gap-1.5 px-2 py-1 u-mono text-[9.5px] uppercase tracking-[0.14em] text-fog transition-colors hover:bg-white/5 hover:text-bone sm:min-h-9 sm:px-2.5 sm:text-[10px]"
                    aria-pressed={autoSpin}
                  >
                    {autoSpin ? <Pause className="size-3 text-mint" aria-hidden /> : <Play className="size-3 text-fog" aria-hidden />}
                    <span className="hidden sm:inline">{autoSpin ? "Spin" : "Paused"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPreset(null)}
                    className="hidden min-h-9 items-center px-2 py-1 text-dim transition-colors hover:text-bone sm:flex"
                    aria-label="Sync camera with scroll chapter"
                    title="Auto camera sync"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHudHidden(true)}
                    className="hidden min-h-9 items-center gap-1 px-2 py-1 u-mono text-[10px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-bone md:flex"
                    aria-label="Hide HUD controls"
                    title="Hide HUD (H)"
                  >
                    <EyeOff className="size-3" aria-hidden />
                  </button>
                </div>
              )}
            </div>

            {/* Right: Compact Flagship Drop 001 Acquire Card */}
            {!hudHidden && (
              <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border border-line-strong bg-[#0c0e13]/95 px-3.5 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="u-mono text-base font-bold text-bone sm:text-xl">
                      {fmtUSD(product.priceSale)}
                    </span>
                    <span
                      className={cn(
                        "u-mono text-[9.5px] uppercase tracking-[0.14em]",
                        soldOut ? "text-red" : product.stock <= product.lowStockThreshold ? "text-yellow" : "text-mint"
                      )}
                    >
                      {soldOut ? "Sold out" : `${product.stock} in paddock`}
                    </span>
                    {product.rarity !== "STANDARD" && (
                      <span className="hidden u-mono text-[9.5px] uppercase tracking-[0.14em] text-orange sm:inline">
                        · {RARITY_LABELS[product.rarity]}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate u-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                    {product.scale || "1:64"} · {CONDITION_LABELS[product.condition]} · Drag 360° or scroll
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={soldOut}
                    onClick={addHeroToCart}
                    className="u-btn u-btn-primary min-h-10 px-3.5! py-2! text-[10.5px]!"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {soldOut ? "Sold out" : "Reserve Drop 001"}
                  </button>
                  <Link
                    href={`/product/${product.slug}`}
                    className="u-btn u-btn-ghost min-h-10 px-3! py-2! text-[10.5px]!"
                  >
                    360° Spec <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Continuous Top Scroll-Progress Hairline */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] bg-white/5"
          aria-hidden
        >
          <div
            className="h-full bg-red transition-transform duration-75 will-change-transform"
            style={{
              width: "100%",
              transform: `scaleX(${scrollState.clampedProgress})`,
              transformOrigin: "left center",
            }}
          />
        </div>

        {/* Max-Pro Exit Clearance Overlay (fades in smoothly during 76% -> 100% car launch exit) */}
        <div
          aria-hidden={exitProgress < 0.15}
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-150"
          style={{
            opacity: Math.max(0, (exitProgress - 0.25) / 0.75),
          }}
        >
          <span className="u-mono text-[10px] uppercase tracking-[0.3em] text-red">
            04 // Pit Release Confirmed
          </span>
          <p className="mt-3 text-2xl font-extrabold uppercase tracking-tight text-bone sm:text-4xl">
            Clearance Granted. <span className="u-outline-red">Entering Pit Wall</span>
          </p>
          <span className="mt-5 inline-flex items-center gap-2 u-mono text-[10px] uppercase tracking-[0.22em] text-fog">
            <ArrowDown className="size-3.5 animate-bounce text-red" aria-hidden />
            Keep scrolling
          </span>
        </div>
      </div>
    </section>
  );
}
