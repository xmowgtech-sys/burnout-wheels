import { cache } from "react";
import { getDb, nowIso, run } from "./db";
import type { ChatbotSettings, StorefrontSettings, TrustpilotSettings } from "./types";

export const DEFAULT_STOREFRONT: StorefrontSettings = {
  shipping: { standard: 9900, express: 19900, freeOver: 249900 },
  returnsDays: 7,
  paymentMethods: ["UPI", "COD"],
};

export const DEFAULT_CHATBOT: ChatbotSettings = {
  enabled: true,
  name: "Pit Crew",
  greeting:
    "Hey! I'm the pit crew bot. Ask me about the RB20, shipping, or refunds — or type “human” to flag a teammate.",
  suggestProducts: true,
  showStock: true,
  faqs: [
    {
      keywords: ["ship", "dispatch", "deliver", "courier", "track"],
      answer:
        "Orders are reserved the moment you place them. Standard shipping takes 2–4 business days, express is faster. Every order gets a tracking number you can follow on the Track page.",
    },
    {
      keywords: ["return", "refund", "exchange", "change my mind"],
      answer:
        "Sealed pieces can be returned within 7 days of delivery — just reply to your order confirmation mail with the order number and we'll sort a pickup. Refunds land once the box is back and checked.",
    },
    {
      keywords: ["authentic", "original", "hypershop", "fake", "real"],
      answer:
        "Every piece we list is sourced sealed from authorised suppliers, inspected at the pit lane before dispatch, and shipped in factory packaging. Details in the Trust page.",
    },
    {
      keywords: ["cod", "cash on delivery", "cash"],
      answer: "Yes — cash on delivery is available across India. Keep the exact amount ready for the courier, and every order ships with a GST invoice.",
    },
  ],
  leadCapture: true,
  handoffEmail: "",
  handoffWebhook: "",
};

export const DEFAULT_TRUSTPILOT: TrustpilotSettings = {
  mode: "coming_soon",
  profileUrl: "",
  note: "Trustpilot profile is pending. Until a real profile is connected we show no customer scores anywhere on the site.",
};

function readSetting<T>(key: string, fallback: T): T {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.value) as T) };
  } catch {
    return fallback;
  }
}

/** Per-request deduped settings reads (React.cache). */
export const getStorefront = cache((): StorefrontSettings => readSetting("storefront", DEFAULT_STOREFRONT));
export const getChatbotSettings = cache((): ChatbotSettings => readSetting("chatbot", DEFAULT_CHATBOT));
export const getTrustpilot = cache((): TrustpilotSettings => readSetting("trustpilot", DEFAULT_TRUSTPILOT));

/** Merge a patch into a JSON settings blob. */
export function saveSettings(key: string, patch: Record<string, unknown>): void {
  const db = getDb();
  const current = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  let merged: Record<string, unknown>;
  if (current) {
    try {
      merged = { ...(JSON.parse(current.value) as Record<string, unknown>), ...patch };
    } catch {
      merged = { ...patch };
    }
  } else {
    merged = { ...patch };
  }
  const upd = db.prepare(
    "INSERT INTO settings (key, value, updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"
  );
  run(upd, key, JSON.stringify(merged), nowIso());
}
