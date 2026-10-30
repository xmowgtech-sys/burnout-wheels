import { getDb, nowIso, run } from "./db";
import { getChatbotSettings } from "./settings";
import { logActivity } from "./analytics";
import { listProducts } from "./catalog";
import { after } from "next/server";
import type { ChatMessage, ChatbotSettings, Conversation, ConversationStatus, ConversationWithExcerpt } from "./types";
import { fmtUSD } from "./money";

/* ---------------- conversation plumbing ---------------- */

export function getOrCreateConversation(sessionId: string): Conversation {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM conversations WHERE sessionId = ?").get(sessionId) as
    | { id: number; sessionId: string; email: string | null; name: string | null; status: ConversationStatus; createdAt: string; updatedAt: string }
    | undefined;
  if (existing) return existing;
  if (!sessionId) throw new Error("sessionId required");
  const ts = nowIso();
  const res = run(
    db.prepare("INSERT INTO conversations (sessionId, status, createdAt, updatedAt) VALUES (?, 'BOT', ?, ?)"),
    sessionId, ts, ts
  );
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(res.id) as unknown as Conversation;
  return row;
}

export function messagesFor(conversationId: number): ChatMessage[] {
  const db = getDb();
  return (
    db
      .prepare("SELECT id, conversationId, role, content, createdAt FROM messages WHERE conversationId = ? ORDER BY id ASC LIMIT 200")
      .all(conversationId) as unknown as ChatMessage[]
  ).slice(-100);
}

export function pushMessage(conversationId: number, role: ChatMessage["role"], content: string): ChatMessage {
  const db = getDb();
  const ts = nowIso();
  const res = run(db.prepare("INSERT INTO messages (conversationId, role, content, createdAt) VALUES (?,?,?,?)"), conversationId, role, content, ts);
  db.prepare("UPDATE conversations SET updatedAt = ? WHERE id = ?").run(ts, conversationId);
  return { id: res.id, conversationId, role, content, createdAt: ts };
}

/* ---------------- the pit-crew brain ---------------- */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
const GREETING_RE = /^(hi+|hey+|hello+|yo|namaste|good (morning|evening|afternoon))\b/i;
const HUMAN_RE = /\b(human|agent|person|real (person|human)|operator|team|crew|support|complain|refuse|frustrat)/i;
const SHIPPING_RE = /\b(ship|shipping|dispatch|deliver|courier|track|tracking|when will|how long)\b/i;
const RETURN_RE = /\b(return|refund|exchange|cancel my|broken|damaged|wrong item)\b/i;
const PRODUCT_RE = /\b(product|price|buy|rb20|red bull|f1|scale|stock|available|catalog|catalogue|car|cars|model|diecast|die-cast|what do you sell|items)\b/i;
const DISCOUNT_RE = /\b(discount|coupon|promo|sale|offer|deal|cheap)\b/i;
const HANDS_RE = /\b(purchase|buy now|order|checkout|add to cart|cart)\b/i;

interface BrainContext {
  conversation: Conversation;
  text: string;
  settings: ChatbotSettings;
}

function faqFor(text: string, settings: ChatbotSettings): string | null {
  const lower = text.toLowerCase();
  for (const faq of settings.faqs) {
    if (faq.keywords.some((k) => lower.includes(k.toLowerCase()))) return faq.answer;
  }
  return null;
}

function productDigest(settings: ChatbotSettings): string {
  const products = listProducts({ status: "ACTIVE", limit: 5 });
  if (products.length === 0) return "The grid is quiet right now — the next drop hasn't been seeded yet.";
  const lines = products.slice(0, 3).map((p) => {
    const stock = settings.showStock
      ? p.stock > 0
        ? `${p.stock} in hand`
        : "sold out"
      : "";
    return `• ${p.name} — ${fmtUSD(p.priceSale)}${stock ? ` · ${stock}` : ""} · /product/${p.slug}`;
  });
  return lines.join("\n");
}

function generate(ctx: BrainContext): { reply: string; status: ConversationStatus; handoff: boolean } {
  const { conversation, text, settings } = ctx;
  const trimmed = text.trim();

  // Email capture (lead)
  const emailHit = trimmed.match(EMAIL_RE)?.[0];
  if (emailHit && emailHit.toLowerCase() !== conversation.email?.toLowerCase()) {
    const guessName =
      trimmed
        .replace(EMAIL_RE, "")
        .replace(/[^\w\s]/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(" ")
        .slice(0, 60) || null;
    const db = getDb();
    db.prepare("UPDATE conversations SET email = ?, name = CASE WHEN name IS NULL OR name = '' THEN ? ELSE name END WHERE id = ?").run(
      emailHit.toLowerCase(),
      guessName,
      conversation.id
    );
  }

  // Human handoff
  if (HUMAN_RE.test(trimmed)) {
    return {
      reply:
        "Flagged for the crew — a teammate will pick this thread up in the paddock radio. Meanwhile, drop your email here and I'll attach it to the thread.",
      status: "HANDOFF_PENDING",
      handoff: true,
    };
  }

  // FAQ priority: returns/shipping/discounts
  if (RETURN_RE.test(trimmed)) {
    return { reply: faqFor(trimmed, settings) ?? DEFAULT_RETURN_TEXT, status: conversation.status, handoff: false };
  }
  if (SHIPPING_RE.test(trimmed)) {
    return { reply: faqFor(trimmed, settings) ?? DEFAULT_SHIPPING_TEXT, status: conversation.status, handoff: false };
  }
  if (DISCOUNT_RE.test(trimmed)) {
    return {
      reply:
        "Codes don't get dropped in chat — members on the paddock list hear about drops first. join the newsletter at the bottom of the homepage and watch for drop-day codes.",
      status: conversation.status,
      handoff: false,
    };
  }

  if (PRODUCT_RE.test(trimmed)) {
    return {
      reply: settings.suggestProducts
        ? `Straight from the pit lane rack:\n${productDigest(settings)}\n\nTap any piece to open its page and add to cart.`
        : "The full grid lives on the Shop page — filters for category, condition and stock are all live.",
      status: conversation.status,
      handoff: false,
    };
  }

  if (GREETING_RE.test(trimmed) || trimmed.length < 3) {
    return { reply: settings.greeting, status: conversation.status, handoff: false };
  }

  // Buy-intent without a captured lead → capture
  if (HANDS_RE.test(trimmed) && settings.leadCapture && !conversation.email) {
    return {
      reply: "Good instinct. Leave your email here and the crew will confirm stock + hold your piece while checkout is open.",
      status: conversation.status,
      handoff: false,
    };
  }

  const generic = faqFor(trimmed, settings);
  return {
    reply:
      generic ??
      (settings.leadCapture && !conversation.email
        ? "Noted — logged for the crew. Leave your email and I'll flag this thread so they reply to you directly."
        : "Noted — logged for the crew. Anything shipping, returns or product-specific, keep them coming."),
    status: conversation.status,
    handoff: false,
  };
}

const DEFAULT_SHIPPING_TEXT =
  "Standard shipping is ₹99, express is ₹199 — free over ₹2,499. Every order ships with tracking you can follow on the Track page.";
const DEFAULT_RETURN_TEXT =
  "Sealed pieces: 7-day returns from delivery. Reply to your order confirmation with the order number and we'll arrange pickup. Refunds land once the box is back.";

/* ---------------- public API surface ---------------- */

export interface TurnResult {
  reply: string;
  status: ConversationStatus;
}

export function processUserTurn(sessionId: string, text: string): TurnResult {
  const settings = getChatbotSettings();
  if (!settings.enabled) {
    return { reply: "Chat is switched off right now. Email the crew at support and they'll pick it up.", status: "BOT" };
  }
  const conversation = getOrCreateConversation(sessionId);
  pushMessage(conversation.id, "user", text.slice(0, 1200));

  const outcome = generate({ conversation, text, settings });
  pushMessage(conversation.id, "bot", outcome.reply);
  setConversationStatus(conversation.id, outcome.status);
  logActivity("guest", "chat.turn", conversation.sessionId, text.slice(0, 80));

  if (outcome.handoff) {
    const conversationRef = conversation;
    after(async () => {
      await fireHandoffNotifications(conversationRef.sessionId, text, settings);
    });
  }

  return { reply: outcome.reply, status: outcome.status };
}

export function adminReply(conversationId: number, content: string, actor: string): void {
  pushMessage(conversationId, "admin", content.slice(0, 1500));
  setConversationStatus(conversationId, "HANDOFF_ACTIVE");
  logActivity(actor, "chat.reply", `conv#${conversationId}`, content.slice(0, 80));
}

export function resolveConversation(conversationId: number): void {
  setConversationStatus(conversationId, "RESOLVED");
}

export function resetHandoff(conversationId: number): void {
  setConversationStatus(conversationId, "BOT");
}

function setConversationStatus(id: number, status: ConversationStatus): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET status = ?, updatedAt = ? WHERE id = ?").run(status, nowIso(), id);
}

export function listConversations(): ConversationWithExcerpt[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*,
              (SELECT content FROM messages m WHERE m.conversationId = c.id ORDER BY m.id DESC LIMIT 1) AS lastMessage,
              (SELECT COUNT(*) FROM messages m WHERE m.conversationId = c.id) AS messageCount
       FROM conversations c
       ORDER BY c.updatedAt DESC
       LIMIT 100`
    )
    .all() as unknown as (Conversation & { lastMessage: string; messageCount: number })[];
  // null-prototype rows are not RSC-serializable — rebuild as plain objects
  return rows.map((r) => ({
    id: Number(r.id),
    sessionId: String(r.sessionId),
    email: (r.email as string) ?? null,
    name: (r.name as string) ?? null,
    status: r.status as Conversation["status"],
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
    lastMessage: String(r.lastMessage ?? ""),
    messageCount: Number(r.messageCount ?? 0),
  }));
}

export function getConversationBySession(sessionId: string): Conversation | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM conversations WHERE sessionId = ?").get(sessionId) as Conversation | undefined;
  return row ?? null;
}

async function fireHandoffNotifications(sessionId: string, message: string, settings: ChatbotSettings): Promise<void> {
  const payload = { sessionId, message, channel: "burnout-chat" };
  if (settings.handoffWebhook) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      await fetch(settings.handoffWebhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      console.warn("[burnout] handoff webhook failed:", err);
    }
  } else if (settings.handoffEmail) {
    console.info(`[burnout] handoff for ${sessionId} → logged for ${settings.handoffEmail}: ${message.slice(0, 120)}`);
  }
}
