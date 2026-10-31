"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatbotSettings, ConversationWithExcerpt, ChatMessage } from "@/lib/types";

const EMPTY_FAQ: ChatbotSettings["faqs"][number] = { keywords: [], answer: "" };

export function ChatbotPanel({
  settings,
  conversations,
  canManage,
}: {
  settings: ChatbotSettings;
  conversations: ConversationWithExcerpt[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"concierge" | "desk">(conversations.some((c) => c.status === "HANDOFF_PENDING") ? "desk" : "concierge");
  const [form, setForm] = useState<ChatbotSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openConv, setOpenConv] = useState<number | null>(conversations[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [refreshMap, setRefreshMap] = useState<Record<number, number>>({});

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/settings?key=chatbot", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Saved — the widget reflects it on next load.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  const resolve = async (id: number) => {
    setBusy(true);
    await fetch("/api/chat/admin", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "resolve" }) });
    setBusy(false); setRefreshMap((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 })); router.refresh();
  };

  const resetBot = async (id: number) => {
    setBusy(true);
    await fetch("/api/chat/admin", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "reset" }) });
    setBusy(false); setRefreshMap((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 })); router.refresh();
  };

  const sendReply = async (id: number) => {
    const content = reply.trim();
    if (!content) return;
    setBusy(true); setReply("");
    await fetch("/api/chat/admin", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "reply", content }) });
    setBusy(false); setRefreshMap((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 })); router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <button onClick={() => setTab("concierge")} data-active={tab === "concierge"} className="u-chip">Bot settings</button>
        <button onClick={() => setTab("desk")} data-active={tab === "desk"} className="u-chip">
          Conversation desk {conversations.filter((c) => c.status === "HANDOFF_PENDING").length > 0 && <span className="text-red">({conversations.filter((c) => c.status === "HANDOFF_PENDING").length})</span>}
        </button>
      </div>

      {tab === "concierge" && (
        <div className="flex flex-col gap-6">
          <div className="u-card flex flex-wrap items-center gap-6 p-5">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-red" disabled={!canManage} />
              <span className="text-[14px] font-semibold">Radio enabled</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={form.suggestProducts} onChange={(e) => setForm({ ...form, suggestProducts: e.target.checked })} className="accent-red" disabled={!canManage} />
              <span className="text-[14px] font-semibold">Suggest live products</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={form.showStock} onChange={(e) => setForm({ ...form, showStock: e.target.checked })} className="accent-red" disabled={!canManage} />
              <span className="text-[14px] font-semibold">Show stock counts</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={form.leadCapture} onChange={(e) => setForm({ ...form, leadCapture: e.target.checked })} className="accent-red" disabled={!canManage} />
              <span className="text-[14px] font-semibold">Lead capture (email)</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="u-label-txt">Bot name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} className="u-input mt-1.5" maxLength={24} />
            </label>
            <label className="block"><span className="u-label-txt">Handoff email (alerts)</span>
              <input value={form.handoffEmail} onChange={(e) => setForm({ ...form, handoffEmail: e.target.value })} disabled={!canManage} className="u-input mt-1.5" />
            </label>
            <label className="block md:col-span-2"><span className="u-label-txt">Greeting (first thing the visitor sees)</span>
              <textarea value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} disabled={!canManage} className="u-textarea mt-1.5" rows={2} />
            </label>
            <label className="block md:col-span-2"><span className="u-label-txt">Handoff webhook (n8n/Slack/Discord — optional)</span>
              <input value={form.handoffWebhook} onChange={(e) => setForm({ ...form, handoffWebhook: e.target.value })} disabled={!canManage} className="u-input mt-1.5" placeholder="https://hooks…" />
            </label>
          </div>

          {/* FAQ */}
          <fieldset className="u-card p-5">
            <legend className="u-label px-1">FAQ patterns — edited with permissions</legend>
            <p className="u-label-txt mt-2">Keyword list (comma separated) → answer. Matched case-insensitively; first hit wins over generic intents.</p>
            <div className="mt-4 flex flex-col gap-3">
              {form.faqs.map((f, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_2fr]">
                  <input
                    value={f.keywords.join(", ")}
                    onChange={(e) => { const faqs = [...form.faqs]; faqs[i] = { keywords: (e.target.value as string).split(",").map((k) => k.trim().toLowerCase()).filter(Boolean), answer: f.answer }; setForm({ ...form, faqs }); }}
                    placeholder="dispatch, ship time"
                    disabled={!canManage}
                    className="u-input"
                    aria-label="FAQ keywords"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) => { const faqs = [...form.faqs]; faqs[i] = { keywords: f.keywords, answer: e.target.value }; setForm({ ...form, faqs }); }}
                    placeholder="Dispatch runs every morning…"
                    disabled={!canManage}
                    className="u-textarea !min-h-0"
                    rows={2}
                    aria-label="FAQ answer"
                  />
                </div>
              ))}
              {canManage && (
                <button type="button" onClick={() => setForm({ ...form, faqs: [...form.faqs, EMPTY_FAQ] })} className="u-btn u-btn-ghost self-start">+ Add FAQ</button>
              )}
            </div>
          </fieldset>

          {canManage ? (
            <div className="flex items-center gap-4">
              <button onClick={save} disabled={busy} className="u-btn u-btn-primary">{busy ? "Saving…" : "Save chatbot settings"}</button>
              {msg && <p className="u-label-txt" role="status">{msg}</p>}
            </div>
          ) : (
            <p className="u-label-txt">Read-only — chatbot.manage is owner/admin only.</p>
          )}
        </div>
      )}

      {tab === "desk" && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <ul className="flex flex-col gap-2">
            {conversations.length === 0 && <p className="u-card px-4 py-8 text-center u-label-txt">No radio traffic yet.</p>}
            {conversations.map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpenConv(c.id)} className={cn("w-full border px-3.5 py-3 text-left transition-colors", openConv === c.id ? "border-red bg-red/5" : "border-line bg-coal/60 hover:border-line-strong")}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="u-mono truncate text-[12px] font-bold">{c.name || c.email || c.sessionId}</span>
                    <span className={cn("u-badge !text-[9px]",
                      c.status === "HANDOFF_PENDING" && "border-yellow text-yellow",
                      c.status === "HANDOFF_ACTIVE" && "border-red text-red",
                      c.status === "RESOLVED" && "border-mint text-mint",
                      c.status === "BOT" && "border-dim text-dim")}>
                      {c.status}
                    </span>
                  </span>
                  <span className="u-label-txt mt-1.5 block truncate">{c.lastMessage}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="u-card p-5">
            {openConv === null ? <p className="u-label-txt">Pick a conversation.</p> : (
              <>
                <p className="u-label">Transcript #{openConv}</p>
                <div className="mt-4 flex max-h-96 flex-col gap-3 overflow-y-auto pr-2" aria-live="polite">
                  <Transcript convId={openConv} refreshKey={refreshMap[openConv] ?? 0} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as crew…" className="u-input" aria-label="Reply as staff" />
                  <button onClick={() => sendReply(openConv)} disabled={busy || !reply.trim()} className="u-btn u-btn-primary !px-3 !py-3" aria-label="Send reply"><Send className="size-4" /></button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => resolve(openConv)} disabled={busy} className="u-btn u-btn-ghost"><Check className="size-3.5" /> Mark resolved</button>
                  <button onClick={() => resetBot(openConv)} disabled={busy} className="u-btn u-btn-ghost"><RotateCcw className="size-3.5" /> Back to bot</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Transcript({ convId, refreshKey }: { convId: number; refreshKey: number }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/chat/admin?id=${convId}`)
      .then((r) => r.json())
      .then((data: { messages?: ChatMessage[] }) => { if (alive) setMsgs(data.messages ?? []); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [convId, refreshKey]);

  return (
    <>
      {msgs.map((m) => (
        <div key={m.id} className={cn("max-w-[85%] whitespace-pre-line px-3.5 py-2.5 text-[13px] leading-relaxed",
          m.role === "user" ? "self-end bg-white/10" : m.role === "admin" ? "self-start border border-yellow/50 bg-yellow/10" : "self-start border border-line bg-white/5 text-fog")}>
          {m.role !== "user" && <span className="u-label mb-1 block">{m.role === "admin" ? "Crew" : "Bot"}</span>}
          {m.content}
        </div>
      ))}
      {msgs.length === 0 && <p className="u-label-txt">No messages recorded yet.</p>}
    </>
  );
}
