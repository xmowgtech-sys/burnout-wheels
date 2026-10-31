"use client";

import { useEffect } from "react";
import { hasAnalyticsConsent, CONSENT_EVENT } from "@/lib/consent";

/**
 * First-party site monitor (privacy-aware by construction):
 *  - JS errors + unhandled promise rejections (scrubbed: no inputs, no emails, no tokens)
 *  - failed resource loads (missing images/scripts)
 *  - slow page loads + slow interactions
 *  - funnel steps: fire trackFlow() from product cards, checkout, order success
 * Listeners hook once per app load (window flag survives StrictMode double-mounts).
 */

const SEND = "/api/track";

interface Payload {
  type: string;
  level?: "INFO" | "WARN" | "ERROR";
  path?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

function sessionKey(): string {
  // random per-tab session id — never an account id, never persisted beyond the event row
  try {
    let sid = window.sessionStorage.getItem("bw:sid");
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      try {
        window.sessionStorage.setItem("bw:sid", sid);
      } catch {
        /* incognito — fresh id each page */
      }
    }
    return sid;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

/** Scrubs message before it leaves the browser — no form values, no emails, no long tokens. */
function scrub(text: string): string {
  return String(text ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[token]")
    .slice(0, 240);
}

function scrubSafe(reason: unknown): string {
  if (typeof reason === "string") return scrub(reason);
  if (reason instanceof Error) return scrub(`${reason.name}: ${reason.message}`);
  return "non-error rejection";
}

function send(p: Payload) {
  fetch(SEND, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...p,
      message: p.message ? scrub(p.message) : undefined,
      meta: { sid: sessionKey(), ...(p.meta ?? {}) },
    }),
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

/** Funnel step beacon — exported for pages that own a conversion step. */
export function trackFlow(step: string, extra?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  send({ type: `flow_${step}`, level: "INFO", path: window.location.pathname, meta: extra && { ...extra, ts: Date.now() } });
}

/** Drop-off prober — notes carts that were built but never converted. */
export function trackAbandonedCart() {
  if (!hasAnalyticsConsent()) return;
  try {
    const cart = window.localStorage.getItem("bw:cart:v1");
    if (!cart || window.sessionStorage.getItem("bw:cartAbandonedNoted")) return;
    const lines = JSON.parse(cart) as unknown[];
    if (!Array.isArray(lines) || lines.length === 0) return;
    window.sessionStorage.setItem("bw:cartAbandonedNoted", "1");
    if (!window.sessionStorage.getItem("bw:orderPlaced")) {
      send({ type: "drop_cart_abandoned", level: "WARN", path: window.location.pathname, meta: { lines: lines.length } });
    }
  } catch {
    /* ignore */
  }
}

export function SiteMonitor() {
  useEffect(() => {
    const w = window as Window & { __bwMonitorHooked?: boolean };
    if (w.__bwMonitorHooked) return;
    w.__bwMonitorHooked = true;

    let faults = 0;
    const onError = (e: ErrorEvent) => {
      if (++faults > 20) return; // runaway error loop cap
      send({ type: "js_error", level: "ERROR", path: window.location.pathname, message: `${e.message} @ ${(e.filename ?? "").split("/").pop()}:${e.lineno}` });
    };
    const onReject = (e: PromiseRejectionEvent) => {
      send({ type: "js_error", level: "ERROR", path: window.location.pathname, message: `unhandled rejection: ${scrubSafe(e.reason)}` });
    };
    const onFail = (e: Event) => {
      const target = e.target as HTMLImageElement | HTMLScriptElement | null;
      const src = (target as HTMLImageElement | null)?.src ?? "";
      const path = src && src.startsWith(window.location.origin) ? new URL(src).pathname : "(external)";
      send({ type: "resource_fail", level: "WARN", path: window.location.pathname, message: `${target?.tagName?.toLowerCase() ?? "resource"} failed: ${path}` });
    };

    // drop-off: built cart but left without converting (checks on leave/hidden)
    window.addEventListener("pagehide", trackAbandonedCart);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") trackAbandonedCart();
    });

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    window.addEventListener("error", onFail, true); // resource errors only surface during capture

    // page timing — one check per navigation, after load settles
    const t = window.setTimeout(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav && nav.domContentLoadedEventEnd > 4000) {
          send({ type: "page_slow", level: "WARN", path: window.location.pathname, message: `DCL ${Math.round(nav.domContentLoadedEventEnd)}ms`, meta: { dcl: Math.round(nav.domContentLoadedEventEnd) } });
        }
      } catch {
        /* noop */
      }
    }, 3000);

    // interaction latency (approximate INP) — only flag bad interactions
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 300) send({ type: "inp_slow", level: "WARN", path: window.location.pathname, message: `interaction ${Math.round(entry.duration)}ms` });
        }
      });
      observer.observe({ type: "event", buffered: true } as PerformanceObserverInit);
    } catch {
      /* unsupported browser */
    }

    const onConsent = () => {
      if (hasAnalyticsConsent()) send({ type: "flow_session_start", level: "INFO", path: window.location.pathname });
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    onConsent(); // visitors who already accepted

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
      window.removeEventListener("error", onFail, true);
      window.removeEventListener("pagehide", trackAbandonedCart);
      window.removeEventListener(CONSENT_EVENT, onConsent);
      window.clearTimeout(t);
      observer?.disconnect();
    };
  }, []);

  return null;
}
