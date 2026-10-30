import { clsx, type ClassValue } from "clsx";

export function cn(...values: ClassValue[]): string {
  return clsx(values);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function escapeLike(text: string): string {
  return text.replace(/[%_\\]/g, "\\$&").trim();
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const B36 = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** e.g. BW-4FJ8QK-9X */
export function orderNumber(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  let r = "";
  for (let i = 0; i < 2; i++) r += B36[Math.floor(Math.random() * B36.length)];
  return `BW-${t}-${r}`;
}

export function randomSuffix(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += B36[Math.floor(Math.random() * B36.length)];
  return out;
}

export function dayKey(d: Date | string = new Date()): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function lastMonthKeys(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() - 1);
  }
  return out.reverse();
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short" });
}

/* ---------- dialog focus handling ---------- */

/** Traps Tab focus inside `el`; returns a release fn. Call after focusing the dialog. */
export function trapFocus(el: HTMLElement): () => void {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(selector));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !el.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !el.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };
  el.addEventListener("keydown", handler);
  return () => el.removeEventListener("keydown", handler);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function plural(n: number, one: string, many: string = one + "s"): string {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}
