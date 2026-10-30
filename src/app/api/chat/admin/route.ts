import type { NextRequest } from "next/server";
import { messagesFor, adminReply, resolveConversation, resetHandoff } from "@/lib/chatbot";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";

/** GET ?id= — transcript for the conversation desk. */
export async function GET(req: NextRequest) {
  try {
    await requireApiUser("chatbot.view");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ messages: [] }, { status: 400 });
    return Response.json({ messages: messagesFor(id) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH — crew reply / resolve / back-to-bot (conversations.reply). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("conversations.reply");
    const body = (await req.json()) as { id?: number; action?: "reply" | "resolve" | "reset"; content?: string };
    const id = body.id ?? 0;
    if (!id || !body.action) return Response.json({ error: "id and action required" }, { status: 400 });
    if (body.action === "reply") {
      if (!body.content?.trim()) return Response.json({ error: "content required" }, { status: 422 });
      adminReply(id, body.content, me.email);
    } else if (body.action === "resolve") resolveConversation(id);
    else resetHandoff(id);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
