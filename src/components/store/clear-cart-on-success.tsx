"use client";

import { useEffect } from "react";
import { useStore } from "./providers";

/**
 * The order is already paid/placed when this page renders, so the browser cart
 * is stale by definition. Clear it here as well as in the checkout submit
 * handler; this covers refreshes, restored tabs and a success page opened on a
 * different instance.
 */
export function ClearCartOnSuccess({ orderNumber }: { orderNumber: string }) {
  const { clear } = useStore();

  useEffect(() => {
    try {
      // Flag first: if the provider mounts after this component, its initial
      // read must skip the old cart instead of repopulating it.
      window.sessionStorage.setItem("bw:cart:clear-pending", "1");
      window.sessionStorage.setItem(`bw:cart:cleared:${orderNumber}`, "1");
    } catch {
      /* private mode */
    }
    clear();
    try {
      window.localStorage.removeItem("bw:cart:v1");
      window.sessionStorage.removeItem("bw:cart:v1");
    } catch {
      /* private mode */
    }
    // The provider's first-mount effect (full page load) runs after this child
    // effect. Give it a tick to consume the flag, then remove it so a cart the
    // customer builds later is never cleared by a stale marker.
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem("bw:cart:clear-pending");
      } catch {
        /* private mode */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clear, orderNumber]);

  return null;
}
