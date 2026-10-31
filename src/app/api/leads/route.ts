import { NextResponse, type NextRequest } from "next/server";
import { getDb, run, nowIso } from "@/lib/db";
import { rateLimit, ipOf } from "@/lib/auth";

/** Public lead capture (newsletter / chatbot email). */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`lead:${ipOf(req)}`, 6, 30 * 60_000)) {
      return Response.json({ error: "Too many attempts — try again shortly" }, { status: 429 });
    }
    const { email, source } = (await req.json()) as { email?: string; source?: string };
    const clean = (email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
      return Response.json({ error: "Enter a valid email" }, { status: 422 });
    }
    const db = getDb();
    if (!db.prepare("SELECT 1 FROM leads WHERE email = ?").get(clean)) {
      run(
        db.prepare("INSERT INTO leads (email, source, createdAt) VALUES (?,?,?)"),
        clean, source === "chatbot" ? "chatbot" : "footer", nowIso()
      );
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save that right now" }, { status: 500 });
  }
}

void NextResponse;
