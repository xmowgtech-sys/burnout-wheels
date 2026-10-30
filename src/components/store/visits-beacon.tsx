"use client";

import { useEffect } from "react";

/** Fires /api/visits exactly once per browser session (session-storage deduped). */
export function VisitsBeacon() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("bw:visit:v1")) return;
      window.sessionStorage.setItem("bw:visit:v1", "1");
    } catch {
      // storage unavailable — still ping once
    }
    fetch("/api/visits", { method: "POST", keepalive: true }).catch(() => undefined);
  }, []);
  return null;
}
