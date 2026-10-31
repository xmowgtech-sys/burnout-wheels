const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Format minor units (paise) as ₹9,999 — storefront display. */
export function fmtUSD(minor: number): string {
  return inr.format(minor / 100);
}

/** Format minor units preserving paise when non-zero (finance views). */
export function fmtExact(minor: number): string {
  if (minor % 100 === 0) return inr.format(minor / 100);
  return inrPaise.format(minor / 100);
}

/** Parse a rupee amount typed in admin forms ("899" or "899.50") → minor units. */
export function toMinor(input: string | number): number {
  const v = typeof input === "number" ? input : parseFloat(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v * 100));
}

/** Minor units → plain rupee number for form defaults. */
export function toRupees(minor: number): number {
  return Math.round(minor) / 100;
}

export function fmtPct(fraction: number): string {
  const v = fraction * 100;
  return `${v.toFixed(v >= 10 ? 0 : 1)}%`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}
