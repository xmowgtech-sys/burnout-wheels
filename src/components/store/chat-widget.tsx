"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X, Radio } from "lucide-react";
import { useToast } from "./providers";

interface Msg { id: number; role: "user" | "bot" | "admin"; content: string; }

const QUICK = ["What's in the grid?", "Shipping?", "Cancellation & refunds?", "Talk to a human"];

export function ChatWidget({ botName }: { botName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("BOT");
  const cid = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const sessionId = useCallback((): string => {
    if (!cid.current) {
      try {
        const stored = window.sessionStorage.getItem("bw:chat:cid");
        cid.current = stored ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        window.sessionStorage.setItem("bw:chat:cid", cid.current);
      } catch {
        cid.current = `s-${Date.now().toString(36)}`;
      }
    }
    return cid.current;
  }, []);

  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) {
      fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId())}`)
        .then((r) => r.json())
        .then((data: { messages?: Msg[]; status?: string }) => {
          setMessages(data.messages ?? []);
          setStatus(data.status ?? "BOT");
        })
        .catch(() => undefined);
    }
    const poll = window.setInterval(() => {
      fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId())}`)
        .then((r) => r.json())
        .then((data: { messages?: Msg[]; status?: string }) => {
          setMessages(data.messages ?? []);
          setStatus(data.status ?? "BOT");
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(poll);
  }, [open, messages.length, sessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setDraft("");
    setMessages((m) => [...m, { id: Date.now(), role: "user", content: clean }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), message: clean }),
      });
      const data = (await res.json()) as { reply?: string; status?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setMessages((m) => [...m, { id: Date.now() + 1, role: "bot", content: data.reply ?? "Logged for the crew." }]);
      if (data.status) setStatus(data.status);
      if (data.status === "HANDOFF_PENDING") toast("Crew flagged — a teammate will jump in", "info");
    } catch {
      setMessages((m) => [...m, { id: Date.now() + 1, role: "bot", content: "Radio break-up — try again in a second." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : `Chat with ${botName}`}
        className="fixed bottom-5 right-4 z-[60] grid size-13 place-items-center rounded-full bg-red text-white shadow-xl transition-transform hover:scale-105 md:bottom-8 md:right-8 size-14"
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageSquare className="size-5" aria-hidden />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-[60] flex h-[min(560px,70dvh)] w-[min(92vw,380px)] flex-col border border-line bg-coal shadow-2xl anim-rise md:bottom-24 md:right-8" role="dialog" aria-label={`${botName} chat`}>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="grid size-9 place-items-center bg-red text-white"><Radio className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wider">{botName}</p>
              <p className="u-label">{status === "HANDOFF_PENDING" || status === "HANDOFF_ACTIVE" ? "Crew joining…" : "On radio — replies instantly"}</p>
            </div>
            <button onClick={() => setOpen(false)} className="u-label" aria-label="Close chat"><X className="size-4" /></button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-[13px] leading-relaxed text-fog">
                Ask about the drops, shipping, cancellation & refunds — or hand off to the crew. Nothing leaves this thread without you.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] whitespace-pre-line px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user" ? "ml-auto bg-red text-white" : m.role === "admin" ? "border border-yellow/50 bg-yellow/10" : "border border-line bg-white/5"
              }`}>
                {m.role === "admin" && <span className="u-label mb-1 block text-yellow!">Crew</span>}
                {m.content}
              </div>
            ))}
            {busy && <div className="u-label">pit crew typing…</div>}
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} className="u-chip py-1!">{q}</button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-center gap-2 border-t border-line px-3 py-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={status === "HANDOFF_ACTIVE" ? "Crew is listening…" : "Type your message…"}
              className="u-input py-2.5!"
              aria-label="Chat message"
            />
            <button type="submit" disabled={busy || !draft.trim()} className="u-btn u-btn-primary px-3! py-2.5!" aria-label="Send">
              <Send className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
