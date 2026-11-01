"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { readConsent, writeConsent, type ConsentState } from "@/lib/consent";

/**
 * Cookie-consent banner — Accept / Reject / Preferences.
 * Loads translucent-dark, motorsport-styled, bottom-left, keyboard accessible,
 * never overlays policy links (sits above the footer, z-index below modals).
 * Optional analytics beacons do NOT fire until consent says so.
 */

function Row({ id, label, note, on, locked, onChange }: { id: string; label: string; note: string; on: boolean; locked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <div>
        <label htmlFor={id} className="text-[13px] font-semibold">{label}{locked && <span className="u-label ml-2 text-dim!">always on</span>}</label>
        <p className="mt-1 text-[12px] leading-relaxed text-fog">{note}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={on}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-red disabled:opacity-60"
      />
    </div>
  );
}

export function ConsentBanner() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [open, setOpen] = useState(false); // mounted check happens in effect
  const [prefs, setPrefs] = useState({ functional: true, analytics: true, marketing: false });
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    setState(readConsent());
    setOpen(true); // banner visibility decided after hydration — no flash for consented visitors
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state) setShowPrefs(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);

  const decide = (choice: "accepted" | "rejected") => {
    writeConsent(choice, choice === "rejected" ? { functional: false, analytics: false, marketing: false } : prefs);
    setState(readConsent());
    setShowPrefs(false);
  };

  if (!open || state) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="fixed bottom-4 left-4 z-[80] w-[min(92vw,430px)] border border-line-strong bg-coal/97 p-5 shadow-2xl backdrop-blur-md anim-rise"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-yellow" aria-hidden />
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide">Cookies, straight up</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fog">
            Essential cookies keep the pits running. Everything else — visit counts, funnel analytics, marketing — stays off until you say yes.
            No third-party ad trackers. Change your mind any time from the footer.
          </p>
        </div>
      </div>

      {showPrefs ? (
        <div className="mt-4 border border-line bg-white/[0.02] px-4 py-2">
          <Row id="ck-essential" label="Essential" note="Cart, checkout, security sessions. The site cannot run without these." on locked />
          <Row id="ck-functional" label="Functional" note="Remembers your consent choice and UI preferences." on={!state && prefs.functional} onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))} />
          <Row id="ck-analytics" label="Analytics" note="Anonymous visit + funnel counts only. No profiling, no cross-site tracking." on={!state && prefs.analytics} onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))} />
          <Row id="ck-marketing" label="Marketing" note="Coming soon — reserved for future campaign pixels. Currently consent never fires them." on={!state && prefs.marketing} onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => decide("accepted")} className="u-btn u-btn-primary py-2.5! text-[13px]!">Accept all</button>
        <button onClick={() => decide("rejected")} className="u-btn u-btn-ghost py-2.5! text-[13px]!">Reject optional</button>
        <button onClick={() => setShowPrefs((s) => !s)} className="u-label px-3 py-2 hover:text-bone!" aria-expanded={showPrefs}>
          {showPrefs ? "Hide preferences" : "Preferences"}
        </button>
        {showPrefs && (
          <button onClick={() => decide("accepted")} className="u-btn u-btn-primary py-2! text-[12px]!">Save choices</button>
        )}
      </div>
      <p className="u-label-txt mt-3 text-dim!">Full details in the <a href="/privacy" className="underline">Privacy Policy</a>.</p>
    </div>
  );
}
