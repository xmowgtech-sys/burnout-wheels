"use client";

/**
 * Cookie consent, tiny and honest. Stored versioned in localStorage; the
 * `bw_consent` cookie mirrors the choice so any server component can read it too.
 * Analytics beacons (visits, funnel, page timings) only load when analytics=true.
 * Error/ops telemetry is first-party and scrubbed, but still individuals' data —
 * so it obeys the same switch except for critical server errors, which keep
 * privacy-safe server logs regardless.
 */

export interface ConsentState {
  v: 1;
  choice: "accepted" | "rejected";
  categories: { essential: true; analytics: boolean; marketing: boolean; functional: boolean };
  at: string;
}

const KEY = "bw:consent:v1";
export const CONSENT_COOKIE = "bw_consent";
export const CONSENT_EVENT = "bw:consent";

export function readConsent(): ConsentState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  const c = readConsent();
  return Boolean(c && c.categories.analytics);
}

/** Accepted-all / rejected-optional presets, or a custom set from Preferences. */
export function writeConsent(choice: "accepted" | "rejected", custom?: { functional: boolean; analytics: boolean; marketing: boolean }): ConsentState {
  const state: ConsentState = {
    v: 1,
    choice,
    categories: {
      essential: true,
      analytics: choice === "accepted" ? true : (custom?.analytics ?? false),
      marketing: choice === "accepted" ? true : (custom?.marketing ?? false),
      functional: choice === "accepted" ? true : (custom?.functional ?? false),
    },
    at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    // Cookie mirrors choice (not site data) so SSR/edge reads stay possible.
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ c: state.choice, a: state.categories.analytics }))}; path=/; max-age=${180 * 24 * 3600}; samesite=lax`;
  } catch {
    /* storage blocked — session-only consent */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  return state;
}
