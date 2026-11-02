import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orderNumber?: string; channel?: string };
    const numClean = body.orderNumber?.trim().toUpperCase();
    const ch = body.channel === "whatsapp" ? "WHATSAPP" : "DISCORD";

    if (numClean) {
      const db = getDb();
      db.prepare("UPDATE orders SET paymentChannel = ? WHERE UPPER(number) = ?").run(ch, numClean);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
