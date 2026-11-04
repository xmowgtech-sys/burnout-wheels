"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { OrderDetailContent } from "@/components/admin/order-detail-content";
import { formatOrderSummary } from "@/lib/order-summary";
import type { OrderWithRelations } from "@/lib/types";

/**
 * Slide-over order detail built entirely from the orders-list response. It
 * never needs a second serverless request, so it still works when Blob is not
 * configured or the request lands on a cold instance.
 */
export function AdminOrderDrawer({
  order,
  onClose,
}: {
  order: OrderWithRelations | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!order) return;
    scrollRef.current?.scrollTo({ top: 0 });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [order, onClose]);

  useEffect(() => {
    setCopied(false);
  }, [order?.number]);

  if (!order) return null;

  const copyDetails = async () => {
    const text = formatOrderSummary(order);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[95] anim-fade" role="dialog" aria-modal="true" aria-label={`Order ${order.number} details`}>
      <button
        type="button"
        aria-label="Close order details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/80 backdrop-blur-sm"
      />

      <div className="anim-drawer absolute inset-y-0 right-0 flex w-[min(96vw,780px)] flex-col border-l border-line bg-ink shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="u-label">Order details</p>
            <p className="u-mono mt-1 text-lg font-bold text-white">{order.number}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyDetails()}
              className="u-btn u-btn-ghost px-3! py-1.5! text-[11px]! font-semibold flex items-center gap-1.5"
            >
              {copied ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy details"}
            </button>
            <Link
              href={`/admin/orders/${order.number}`}
              className="u-btn u-btn-ghost px-3! py-1.5! text-[11px]! font-semibold flex items-center gap-1.5"
            >
              Full page <ExternalLink className="size-3" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close order details"
              className="rounded border border-line p-2 text-fog transition-colors hover:border-bone hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          <OrderDetailContent order={order} compact />
        </div>

        <div className="border-t border-line bg-surface/70 px-5 py-3 text-[11px] text-dim">
          Loaded from the orders list itself — available even during a cold start or before Blob storage is connected.
        </div>
      </div>
    </div>
  );
}
