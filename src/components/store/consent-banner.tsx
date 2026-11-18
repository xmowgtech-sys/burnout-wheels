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
      data-lenis-prevent
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-line-strong bg-coal/97 px-4 py-2.5 shadow-2xl md:px-6"
    >
      <div className="mx-auto max-w-[1500px]">
        {showPrefs ? (
          <div className="mb-3 border border-line bg-ink/80 px-4 py-2">
            <Row id="ck-essential" label="Essential" note="Cart, checkout, security sessions. The site cannot run without these." on locked />
            <Row id="ck-functional" label="Functional" note="Remembers your consent choice and UI preferences." on={!state && prefs.functional} onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))} />
            <Row id="ck-analytics" label="Analytics" note="Anonymous visit + funnel counts only. No profiling, no cross-site tracking." on={!state && prefs.analytics} onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))} />
            <Row id="ck-marketing" label="Marketing" note="Coming soon — reserved for future campaign pixels. Currently consent never fires them." on={!state && prefs.marketing} onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Cookie className="size-4 shrink-0 text-yellow" aria-hidden />
            <p className="text-[12px] leading-snug text-fog">
              <strong className="font-bold uppercase tracking-wider text-bone">Cookies, straight up:</strong>{" "}
              Essential keeps pits running. Optional analytics stay off until you say yes.{" "}
              <a href="/privacy" className="underline hover:text-bone">Privacy Policy</a>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="u-btn u-btn-primary min-h-9! px-3.5! py-1.5! text-[11px]!"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="u-btn u-btn-ghost min-h-9! px-3.5! py-1.5! text-[11px]!"
            >
              Reject optional
            </button>
            <button
              type="button"
              onClick={() => setShowPrefs((s) => !s)}
              className="u-label min-h-9 px-2.5 py-1.5 hover:text-bone!"
              aria-expanded={showPrefs}
            >
              {showPrefs ? "Hide prefs" : "Preferences"}
            </button>
            {showPrefs && (
              <button
                type="button"
                onClick={() => decide("accepted")}
                className="u-btn u-btn-primary min-h-9! px-3! py-1.5! text-[11px]!"
              >
                Save choices
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
