"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "./providers";
import {
  SakugaButton,
  SakugaCheckbox,
  SakugaInput,
  SakugaProgress,
  SakugaRadioGroup,
  SakugaRating,
  SakugaSlider,
  SakugaTabs,
  SakugaToggle,
  SakugaTooltip,
} from "./sakuga-controls";
import { useSakugaVfx } from "./sakuga-vfx-layer";

const COMPOUND_OPTIONS = [
  { value: "soft", label: "Soft — Qualifying Grip", accent: "#e10600" },
  { value: "medium", label: "Medium — Race Balance", accent: "#ffe600" },
  { value: "hard", label: "Hard — Endurance Stint", accent: "#7cb8ff" },
];

const LAB_TABS = [
  { id: "telemetry", label: "Telemetry" },
  { id: "aero", label: "Aero" },
  { id: "setup", label: "Setup" },
];

function ControlCard({
  index,
  title,
  hint,
  status,
  children,
}: {
  index: string;
  title: string;
  hint: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[256px] flex-col justify-between rounded-[4px] border border-line bg-panel p-6 transition-colors duration-200 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3.5">
        <div>
          <p className="u-label text-fog!">
            {index} · {title}
          </p>
          <p className="mt-1 text-xs text-dim">{hint}</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">{children}</div>

      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="u-label text-dim!">Output</span>
        <span className="u-mono text-[11px] font-medium text-bone">{status}</span>
      </div>
    </section>
  );
}

export function SakugaGallery() {
  const { enabled, setEnabled, reducedMotion } = useSakugaVfx();
  const { toast } = useToast();

  const [primaryClicks, setPrimaryClicks] = useState(0);
  const [secondaryClicks, setSecondaryClicks] = useState(0);
  const [alertsOn, setAlertsOn] = useState(true);
  const [boost, setBoost] = useState(65);
  const [sealed, setSealed] = useState(true);
  const [compound, setCompound] = useState("soft");
  const [callsign, setCallsign] = useState("");
  const [activeTab, setActiveTab] = useState("telemetry");
  const [progressRuns, setProgressRuns] = useState(0);
  const [rating, setRating] = useState(4);
  const [toastCount, setToastCount] = useState(0);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 md:px-8 md:pt-28">
      {/* Editorial Header */}
      <header className="border-b border-line pb-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="u-label text-red!">Burnout Wheels · Interactive FX Lab</p>
            <h1 className="u-h1 mt-3">
              Sakuga <span className="u-outline">VFX</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-fog md:text-base">
              Twelve tactile controls animated like hand-drawn anime: spring squash-and-overshoot physics paired with
              live canvas bursts — impact spikes, cel-shaded smoke puffs, katana slashes, star sparkles, and manga SFX
              lettering. Every effect runs on one shared overlay across the entire Burnout Wheels store and disables
              automatically for <span className="u-mono text-bone">prefers-reduced-motion</span>.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-[4px] border border-line bg-panel p-5 sm:min-w-[300px]">
            <div className="flex items-center justify-between gap-4">
              <span className="u-label text-bone!">Site-Wide VFX Canvas</span>
              <span
                className={`u-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  reducedMotion ? "text-yellow" : enabled ? "text-mint" : "text-dim"
                }`}
              >
                {reducedMotion ? "OS Reduced Motion" : enabled ? "Active" : "Paused"}
              </span>
            </div>
            <SakugaToggle
              ariaLabel="Site-wide Sakuga VFX"
              label={enabled ? "Anime VFX On" : "Anime VFX Off"}
              checked={enabled && !reducedMotion}
              onChange={(next) => setEnabled(next)}
            />
            <p className="text-[11px] leading-relaxed text-dim">
              Applies to every button, wishlist heart, cart trigger, and toast across Home, Shop, and Product pages.
            </p>
          </div>
        </div>
      </header>

      {/* 12 Interactive Controls Grid */}
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* 01. Primary button */}
        <ControlCard
          index="01"
          title="Primary Button"
          hint="Heavy squash + jagged impact burst + ドン!"
          status={primaryClicks === 0 ? "Click to fire" : `Clicked · ${primaryClicks}×`}
        >
          <SakugaButton
            variant="primary"
            label="Launch Order"
            sfxLabel="ドン!"
            onClick={() => setPrimaryClicks((n) => n + 1)}
          />
        </ControlCard>

        {/* 02. Secondary button */}
        <ControlCard
          index="02"
          title="Secondary Button"
          hint="Snappy overshoot + diagonal wind slash"
          status={secondaryClicks === 0 ? "Click to slash" : `Slashed · ${secondaryClicks}×`}
        >
          <SakugaButton
            variant="secondary"
            label="Pit Hold"
            sfxLabel="シュッ!"
            onClick={() => setSecondaryClicks((n) => n + 1)}
          />
        </ControlCard>

        {/* 03. Toggle */}
        <ControlCard
          index="03"
          title="Toggle Switch"
          hint="Spring thumb overshoot + cel-shaded smoke"
          status={`change: ${alertsOn ? "on" : "off"}`}
        >
          <SakugaToggle label="Drop Alerts" checked={alertsOn} onChange={setAlertsOn} />
        </ControlCard>

        {/* 04. Slider */}
        <ControlCard
          index="04"
          title="Momentum Slider"
          hint="Drag fast & release for spring recoil + splash"
          status={`Turbo Boost · ${boost}%`}
        >
          <SakugaSlider label="Turbo Boost" value={boost} onChange={setBoost} />
        </ControlCard>

        {/* 05. Checkbox */}
        <ControlCard
          index="05"
          title="Checkbox"
          hint="Elastic pop + ink checkmark flash"
          status={sealed ? "Checked" : "Unchecked"}
        >
          <SakugaCheckbox label="Sealed Case Verified" checked={sealed} onChange={setSealed} />
        </ControlCard>

        {/* 06. Radio */}
        <ControlCard
          index="06"
          title="Radio Group"
          hint="Spring core dot + compound smoke ring"
          status={`Selected: ${compound.toUpperCase()}`}
        >
          <SakugaRadioGroup
            name="tyre-compound"
            ariaLabel="Tyre Compound"
            options={COMPOUND_OPTIONS}
            value={compound}
            onChange={setCompound}
          />
        </ControlCard>

        {/* 07. Text Input */}
        <ControlCard
          index="07"
          title="Text Input"
          hint="Focus slash + live keystroke sparks"
          status={callsign.trim() ? `value: "${callsign.trim()}"` : "Type to spark"}
        >
          <SakugaInput
            label="Paddock Callsign"
            placeholder="Type RB20 or your callsign…"
            value={callsign}
            onChange={setCallsign}
          />
        </ControlCard>

        {/* 08. Tabs */}
        <ControlCard
          index="08"
          title="Tabs"
          hint="Click or use Arrow keys for katana sweep"
          status={`Active tab: ${activeTab.toUpperCase()}`}
        >
          <SakugaTabs
            ariaLabel="Telemetry modes"
            tabs={LAB_TABS}
            value={activeTab}
            onChange={setActiveTab}
          />
        </ControlCard>

        {/* 09. Progress */}
        <ControlCard
          index="09"
          title="Progress Bar"
          hint="Surging pit-stop fill + 100% 完了! checkmark"
          status={progressRuns > 0 ? `Completed (${progressRuns}×) · click to replay` : "Charging…"}
        >
          <SakugaProgress
            label="Pit stop telemetry load"
            onDone={() => setProgressRuns((n) => n + 1)}
          />
        </ControlCard>

        {/* 10. Rating */}
        <ControlCard
          index="10"
          title="Star Rating"
          hint="Staggered wave bounce + 5-star キラッ!! burst"
          status={`${rating} / 5 stars`}
        >
          <SakugaRating value={rating} onChange={setRating} />
        </ControlCard>

        {/* 11. Toast */}
        <ControlCard
          index="11"
          title="Toast Alert"
          hint="Triggers live storefront spring toast + VFX"
          status={toastCount === 0 ? "Ready to dispatch" : `Sent · ${toastCount}×`}
        >
          <SakugaButton
            variant="primary"
            label="Save Setup"
            sfxLabel="完了!"
            onClick={() => {
              const next = toastCount + 1;
              setToastCount(next);
              toast(`Telemetry setup #${next} locked into paddock`, "ok");
            }}
          />
        </ControlCard>

        {/* 12. Tooltip */}
        <ControlCard
          index="12"
          title="Tooltip"
          hint="Hover, focus, or tap ? for spring callout"
          status="Hover / focus / tap"
        >
          <SakugaTooltip
            buttonLabel="Show paddock hint"
            hint="Zero dependencies · 1 shared canvas · 60fps idle-safe"
          />
        </ControlCard>
      </div>

      {/* Storefront Bridge CTA */}
      <footer className="mt-14 flex flex-col items-start justify-between gap-6 border border-line bg-coal p-6 md:flex-row md:items-center md:p-8">
        <div>
          <p className="u-label flex items-center gap-2 text-yellow!">
            <Sparkles className="size-3.5" aria-hidden="true" /> Live Across The Storefront
          </p>
          <h2 className="u-h3 mt-2">Take the Sakuga engine onto the grid</h2>
          <p className="mt-1.5 max-w-xl text-sm text-fog">
            Wishlist a die-cast car for a sparkle burst, drop a model into your cart for an impact hit, or toggle quick
            compare for a slash sweep.
          </p>
        </div>
        <Link href="/shop" className="u-btn u-btn-primary shrink-0">
          <span>Explore The Shop</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
