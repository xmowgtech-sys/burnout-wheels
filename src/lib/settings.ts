import { cache } from "react";
import { getDb, nowIso, run } from "./db";
import type { ChatbotSettings, StorefrontSettings, TrustpilotSettings } from "./types";

export const DEFAULT_HERO_IMAGE =
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg";

export const DEFAULT_STOREFRONT: StorefrontSettings = {
  shipping: { standard: 9900, express: 19900, freeOver: 249900 },
  returnsDays: 7,
  paymentMethods: ["UPI", "COD"],
  home: {
    heroDesktopImage: DEFAULT_HERO_IMAGE,
    heroMobileImage: "",
    heroFit: "cover",
    heroPosition: "center",
    heroKicker: "Die-cast pit lane — live from Mohali",
    heroHeadline: "Raw metal.\nRacing blood.",
    heroSubline:
      "Die-cast built to race-lace spec: sealed, inspected and catalogued like telemetry. One drop at a time — when it's gone, it's gone.",
    heroDropProductId: null,
    featuredProductId: null,
    featuredLabel: "Featured drop",
    tickerItems: [
      "Sealed & inspected",
      "1:18 / 1:43 / 1:64",
      "UPI · COD · PayPal live",
      "Free shipping over ₹2,499",
      "Mohali → pan-India",
      "Drop calls first on Discord",
    ],
    gridProductIds: [],
    gridTitle: "Shop the grid",
    gridSubline: "Every unit is hand-checked against the box, the casting and the livery before it lists.",
    trustTitle: "Trust, not tapes.",
    trustSubline: "No star inflation, no invented reviews. Policies and proof do the talking.",
    newsletterTitle: "First call on drops. Zero spam laps.",
    newsletterSubline:
      "Drop windows sell through in minutes. The list hears first, always with dates and units — never with invented hype.",
    showPitWall: true,
    showProductIndex: true,
  },
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
        "Cancellation is free until the parcel ships. After delivery, refunds are only for proven damage or a not-as-listed item, claimed with an unboxing video within 48 hours. There are no general returns — the full protocol is on the Refund & cancellation page.",
    },
    {
      keywords: ["authentic", "original", "hypershop", "fake", "real"],
      answer:
        "Every piece we list is sourced sealed from authorised suppliers, inspected at the pit lane before dispatch, and shipped in factory packaging. Details in the Trust page.",
    },
    {
      keywords: ["cod", "cash on delivery", "cash"],
      answer:
        "Yes — cash on delivery is available pan-India. COD orders need a ₹200 online advance before we pack; it is adjusted against your total, and the balance is paid to the courier. Pay the advance live with a human on WhatsApp or Discord.",
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Merge saved settings over the current defaults so new fields ship without a migration step. */
function mergeDefaults<T>(fallback: T, saved: unknown): T {
  if (!isPlainObject(fallback) || !isPlainObject(saved)) return (saved ?? fallback) as T;
  const out: Record<string, unknown> = { ...fallback };
  for (const [key, value] of Object.entries(saved)) {
    const base = (fallback as Record<string, unknown>)[key];
    out[key] = isPlainObject(base) && isPlainObject(value) ? mergeDefaults(base, value) : value;
  }
  return out as T;
}

function readSetting<T>(key: string, fallback: T): T {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return mergeDefaults(fallback, JSON.parse(row.value));
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
      merged = mergeDefaults(JSON.parse(current.value) as Record<string, unknown>, patch);
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
