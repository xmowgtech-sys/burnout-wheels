import { getDb, nowIso, run } from "./db";
import { dayKey, daysAgoIso } from "./utils";
import type { ActivityRow } from "./types";

/** Static-session pageview counter. One bump per visitor session (client-deduped). No cookies, no PII. */
export function bumpVisit(): void {
  const db = getDb();
  const upd = db.prepare(
    "INSERT INTO visits (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1"
  );
  run(upd, dayKey());
}

export function sessionsSince(days: number): number {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(SUM(count), 0) as n FROM visits WHERE day >= ?").get(dayKey(daysAgoIso(days))) as {
    n: number;
  };
  return row.n;
}

export interface VisitPoint {
  day: string;
  count: number;
}

export function visitsSeries(days: number): VisitPoint[] {
  const db = getDb();
  const rows = db.prepare("SELECT day, count FROM visits WHERE day >= ? ORDER BY day ASC").all(dayKey(daysAgoIso(days))) as {
    day: string;
    count: number;
  }[];
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: VisitPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(daysAgoIso(i));
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

export function logActivity(actor: string, action: string, entity = "", detail = ""): void {
  try {
    const db = getDb();
    run(
      db.prepare("INSERT INTO activityLog (actor, action, entity, detail, createdAt) VALUES (?,?,?,?,?)"),
      actor,
      action,
      entity,
      detail,
      nowIso()
    );
  } catch (err) {
    // Activity feed must never break the main flow.
    console.warn("[burnout] activity log failed:", err);
  }
}

export function recentActivity(limit = 10): ActivityRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, actor, action, entity, detail, createdAt FROM activityLog ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as ActivityRow[];
  return rows;
}
