import { NextResponse, type NextRequest } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { processUserTurn } from "@/lib/chatbot";
import { rateLimit, ipOf } from "@/lib/auth";

type MsgRow = { id: number; role: string; content: string; createdAt: string };

/** GET ?sessionId= — chat history for the widget & admin conversations. */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return Response.json({ messages: [], status: "BOT" });
    const db = getDb();
    const convo = db.prepare("SELECT id, status FROM conversations WHERE sessionId = ?").get(sessionId) as
      | { id: number; status: string }
      | undefined;
    if (!convo) return Response.json({ messages: [], status: "BOT" });
    const messages = (db
      .prepare("SELECT id, role, content, createdAt FROM messages WHERE conversationId = ? ORDER BY id ASC")
      .all(convo.id) as MsgRow[]).map((m) => ({ id: m.id, role: m.role, content: m.content }));
    return Response.json({ messages, status: convo.status });
  } catch {
    return Response.json({ messages: [] }, { status: 500 });
  }
}

/** POST — a user turn through the chatbot engine. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`chat:${ipOf(req)}`, 30, 60_000)) {
      return Response.json({ reply: "Easy on the radio — one message at a time.", status: "BOT" }, { status: 429 });
    }
    const { sessionId, message } = (await req.json()) as { sessionId?: string; message?: string };
    if (!sessionId || !message?.trim()) return Response.json({ error: "sessionId and message required" }, { status: 422 });
    const result = processUserTurn(sessionId, message.trim());
    return Response.json(result);
  } catch {
    return Response.json({ reply: "Radio break-up — try again.", status: "BOT" }, { status: 500 });
  }
}

void NextResponse;
