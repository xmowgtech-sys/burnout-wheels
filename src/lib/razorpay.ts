import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb, nowIso, run } from "./db";

/**
 * UPI payments via Razorpay (and an honest manual-UPI fallback).
 * Config lives in the settings table key "payments" — secrets never reach the client;
 * only the public key id is exposed to open the checkout. Amounts are paise.
 */

export interface PaymentsConfig {
  razorpayKeyId: string; //INVITE rzp_test_…
  razorpayKeySecret: string; // server-only
  upiVpa: string; // manual fallback, e.g. burnoutwheels@upi
}

const KEY = "payments";

export function getPayments(): PaymentsConfig | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    const cfg = JSON.parse(row.value) as PaymentsConfig;
    if (!cfg.razorpayKeyId || !cfg.razorpayKeySecret) return null;
    return cfg;
  } catch {
    return null;
  }
}

export function setPayments(cfg: PaymentsConfig): void {
  const db = getDb();
  run(
    db.prepare("INSERT INTO settings (key, value, updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"),
    KEY,
    JSON.stringify(cfg),
    nowIso()
  );
}

/** Looks up a pending order by number — payment context only (no sensitive fields returned). */
export function findOrderForPayment(number: string): { id: number; total: number; email: string; name: string; status: string; number: string } | null {
  const db = getDb();
  const row = db.prepare("SELECT id, number, total, email, name, status FROM orders WHERE number = ?").get(number.trim()) as
    | { id: number; number: string; total: number; email: string; name: string; status: string }
    | undefined;
  return row ?? null;
}

/** Creates the gateway order; returns the id Razorpay Checkout needs. */
export async function createRazorpayOrder(cfg: PaymentsConfig, amountPaise: number, receipt: string): Promise<string> {
  const auth = Buffer.from(`${cfg.razorpayKeyId}:${cfg.razorpayKeySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, payment_capture: 1 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
    throw new Error(body.error?.description || `Razorpay order failed (${res.status})`);
  }
  const data = (await res.json()) as { id: string };
  if (!data.id) throw new Error("Razorpay returned no order id");
  return data.id;
}

/** HMAC-SHA256 of `order_id|payment_id` with the key secret — Razorpay's documented signature. */
export function verifyRazorpaySignature(cfg: PaymentsConfig, orderId: string, paymentId: string, signature: string): boolean {
  const digest = createHmac("sha256", cfg.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Marks the order paid once the signature verifies. Returns false if the order vanished. */
export function markOrderPaid(number: string, paymentId: string): boolean {  const db = getDb();
  const row = db.prepare("SELECT id FROM orders WHERE number = ?").get(number.trim()) as { id: number } | undefined;
  if (!row) return false;
  const ts = nowIso();
  run(db.prepare("UPDATE orders SET status = 'PAID', updatedAt = ? WHERE id = ?"), ts, row.id);
  run(
    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
    row.id, "PAID", `UPI payment received (${paymentId})`, "razorpay", ts
  );
  return true;
}
