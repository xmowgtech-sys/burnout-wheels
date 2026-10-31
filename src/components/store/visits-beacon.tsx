"use client";

import { useEffect } from "react";
import { hasAnalyticsConsent, CONSENT_EVENT } from "@/lib/consent";

/** Fires /api/visits once per browser session — only with analytics consent. */
export function VisitsBeacon() {
  useEffect(() => {
    const fire = () => {
      try {
        if (window.sessionStorage.getItem("bw:visit:v1")) return;
        window.sessionStorage.setItem("bw:visit:v1", "1");
      } catch {
        // storage unavailable — still count the session once
      }
      fetch("/api/visits", { method: "POST", keepalive: true }).catch(() => undefined);
    };
    if (hasAnalyticsConsent()) fire();
    window.addEventListener(CONSENT_EVENT, fire);
    return () => window.removeEventListener(CONSENT_EVENT, fire);
  }, []);
  return null;
}
