import { getDb, nowIso, run } from "./db";
import type { OpsEvent, OpsLevel, OpsSource, SyncLog, Product } from "./types";
import { daysAgoIso } from "./utils";

/**
 * Ops telemetry — one table (opsEvents) for everything the monitoring board reads:
 * JS errors, failed API requests, failed uploads, slow pages, funnel steps, drop-offs,
 * webhook hits, sync results. Privacy-aware by contract: callers never pass form
 * values, passwords, cookies or tokens — only paths, trimmed messages and metadata.
 */

/** Wide-path scrub: strips any value that looks like an email or long secret-ish token. */
export function scrub(text: string, cap = 300): string {
  return String(text ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[token]")
    .slice(0, cap);
}

export function logEvent(ev: {
  source?: OpsSource;
  level?: OpsLevel;
  type: string;
  path?: string;
  message?: string;
  meta?: string;
}): void {
  try {
    const db = getDb();
    run(
      db.prepare("INSERT INTO opsEvents (source, level, type, path, message, meta, createdAt) VALUES (?,?,?,?,?,?,?)"),
      ev.source ?? "SRV",
      ev.level ?? "INFO",
      ev.type,
      scrub(ev.path ?? "", 180),
      scrub(ev.message ?? ""),
      (ev.meta ?? "").slice(0, 500),
      nowIso()
    );
  } catch (err) {
    // Telemetry must never break the request it observes.
    console.warn("[burnout] ops log failed:", err);
  }
}

export function logSync(log: {
  job: string;
  status: "OK" | "FAIL";
  detail?: string;
  items?: number;
  durationMs?: number;
}): void {
  try {
    const db = getDb();
    run(
      db.prepare("INSERT INTO syncLogs (provider, job, status, detail, items, durationMs, createdAt) VALUES (?,?,?,?,?,?,?)"),
      "shopify",
      log.job,
      log.status,
      scrub(log.detail ?? "", 400),
      log.items ?? 0,
      log.durationMs ?? 0,
      nowIso()
    );
  } catch (err) {
    console.warn("[burnout] sync log failed:", err);
  }
}

/* ---------- monitoring-board queries ---------- */

export function recentEvents(limit = 60, level?: OpsLevel): OpsEvent[] {
  const db = getDb();
  const rows = level
    ? (db.prepare("SELECT id, source, level, type, path, message, meta, createdAt FROM opsEvents WHERE level = ? ORDER BY id DESC LIMIT ?").all(level, limit) as unknown as OpsEvent[])
    : (db.prepare("SELECT id, source, level, type, path, message, meta, createdAt FROM opsEvents ORDER BY id DESC LIMIT ?").all(limit) as unknown as OpsEvent[]);
  return rows.map((r) => ({ ...r }));
}

export function eventCounts(hours = 24): { total: number; errors: number; uploadFails: number; apiFails: number; slowPages: number } {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const one = (type: string | null, level?: string) => {
    const sql = `SELECT COUNT(*) AS n FROM opsEvents WHERE createdAt >= ? ${type ? "AND type = ?" : ""} ${level ? "AND level = ?" : ""}`;
    const params: (string)[] = type && level ? [since, type, level] : type ? [since, type] : level ? [since, level] : [since];
    return Number((db.prepare(sql).get(...params) as { n: number } | undefined)?.n);
  };
  return {
    total: one(null),
    errors: one(null, "ERROR"),
    uploadFails: one("upload_fail"),
    apiFails: one("api_fail"),
    slowPages: one("page_slow"),
  };
}

export interface FunnelStep {
  type: string;
  label: string;
  count: number;
}

/** Funnel counts use DISTINCT session keys from meta JSON ({sid:"…"}). */
export function funnel(hours = 24): FunnelStep[] {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const row = db.prepare(
    `SELECT type, COUNT(DISTINCT json_extract(meta, '$.sid')) AS n
     FROM opsEvents
     WHERE createdAt >= ? AND (type LIKE 'flow_%' OR type LIKE 'drop_%') AND json_extract(meta, '$.sid') IS NOT NULL
     GROUP BY type`
  ).all(since) as unknown as { type: string; n: number }[];
  const by = new Map(row.map((r) => [r.type, Number(r.n)]));
  const steps: [string, string, string][] = [
    ["flow_view", "Product page viewed", "flow_view"],
    ["flow_cart_add", "Added to cart", "flow_cart_add"],
    ["flow_checkout_start", "Started checkout", "flow_checkout_start"],
    ["flow_order_placed", "Order placed", "flow_order_placed"],
  ];
  const out: FunnelStep[] = steps.map(([type, label]) => ({ type, label, count: by.get(type) ?? 0 }));
  const drops: [string, string][] = [
    ["drop_cart_abandoned", "Carts left without checkout"],
    ["drop_checkout_abandoned", "Checkouts left without order"],
  ];
  for (const [type, label] of drops) out.push({ type, label, count: by.get(type) ?? 0 });
  return out;
}export function recentSyncs(limit = 20): SyncLog[] {
  const db = getDb();
  return db.prepare("SELECT * FROM syncLogs ORDER BY id DESC LIMIT ?").all(limit) as unknown as SyncLog[];
}

export function recentUnreadMail(limit = 20) {
  const db = getDb();
  return db
    .prepare("SELECT id, toEmail, subject, delivered, createdAt FROM mailLog ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as { id: number; toEmail: string; subject: string; delivered: number; createdAt: string }[];
}

/** Operational alerts: low stock, STAFF login failures, webhook failures in the last 24h. */
export function alerts(products: Product[]): { key: string; text: string; level: OpsLevel }[] {
  const out: { key: string; text: string; level: OpsLevel }[] = [];
  const low = products.filter((p) => p.stock <= p.lowStockThreshold && p.status === "ACTIVE");
  for (const p of low) {
    out.push({ key: `low-${p.id}`, text: `${p.name} is low — ${p.stock} on the shelf`, level: "WARN" });
  }
  const failedLogins = recentEvents(80, "WARN").filter((e) => e.type === "login_fail");
  if (failedLogins.length >= 3) {
    out.push({ key: "logins", text: `${failedLogins.length} failed sign-in attempts recently — review access`, level: "WARN" });
  }
  const webhookFails = recentEvents(80, "ERROR").filter((e) => e.type === "webhook");
  if (webhookFails.length > 0) {
    out.push({ key: "webhooks", text: `${webhookFails.length} Shopify webhook events failed processing`, level: "ERROR" });
  }
  return out.slice(0, 6);
}
