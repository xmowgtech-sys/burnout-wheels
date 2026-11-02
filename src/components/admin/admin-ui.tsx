"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtUSD } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";

/* ---------------- status colors ---------------- */

const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-yellow text-yellow",
  PAYMENT_REVIEW: "border-sky text-sky",
  PAID: "border-mint text-mint",
  PROCESSING: "border-sky text-sky",
  PACKING: "border-purple text-purple",
  SHIPPED: "border-orange text-orange",
  DELIVERED: "border-mint text-mint",
  CANCELLED: "border-dim text-dim",
  REFUNDED: "border-fog text-fog",
};

export function StatusBadge({ status }: { status: OrderStatus | string }) {
  const s = status as OrderStatus;
  return (
    <span className={cn("u-badge", STATUS_TONE[s] ?? "border-dim text-dim")}>
      {ORDER_STATUS_LABELS[s] ?? status}
    </span>
  );
}

/* ---------------- stat card ---------------- */

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div className="u-card p-5">
      <p className="u-label">{label}</p>
      <p className={cn(
        "u-mono mt-3 text-[26px] font-bold leading-none tracking-tight",
        tone === "good" && "text-mint", tone === "warn" && "text-yellow", tone === "bad" && "text-red"
      )}>{value}</p>
      {sub ? <p className="u-label-txt mt-3">{sub}</p> : null}
    </div>
  );
}

/* ---------------- mini charts (pure SVG) ---------------- */

export function AreaChart({ points, height = 120 }: { points: number[]; height?: number }) {
  const w = 400;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, height - (p / max) * (height - 14) - 6]);
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0]!.toFixed(1)},${c[1]!.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Revenue trend">
      <path d={area} className="fill-red/15" />
      <path d={line} fill="none" strokeWidth="2" className="stroke-red" />
    </svg>
  );
}

export function BarChart({ points, labels }: { points: number[]; labels?: string[] }) {
  const max = Math.max(...points, 1);
  return (
    <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Order volume">
      {points.map((p, i) => (
        <div key={i} className="group relative flex-1" title={labels?.[i]}>
          <div
            className={cn("w-full transition-colors", p === 0 ? "bg-line" : "bg-red/80 group-hover:bg-red")}
            style={{ height: `${Math.max((p / max) * 100, p === 0 ? 3 : 6)}%`, minHeight: 3 }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------------- table ---------------- */

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="u-card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} className="u-label whitespace-nowrap px-4 py-3.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td title={title} className={cn("px-4 py-3.5 align-middle", className)}>{children}</td>;
}

/* ---------------- confirm dialog ---------------- */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    (el?.querySelector("button[data-primary]") as HTMLButtonElement | null)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] anim-fade" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/80 backdrop-blur-sm" />
      <div ref={ref} className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 anim-rise">
        <div className="u-card p-6">
          <p className="u-h3">{title}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">{body}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={onClose} className="u-btn u-btn-ghost">Cancel</button>
            <button
              data-primary
              onClick={() => { onConfirm(); onClose(); }}
              className={cn(danger ? "u-btn u-btn-danger" : "u-btn u-btn-primary")}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- misc ---------------- */

export function Money({ paise }: { paise: number }) {
  return <span className="u-mono">{fmtUSD(paise)}</span>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="u-label-txt">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="u-label-txt mt-1.5">{hint}</p> : null}
    </label>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-red" aria-hidden />
      <span className="u-label">{label ?? "Loading"}</span>
    </div>
  );
}
