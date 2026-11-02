import type { NextRequest } from "next/server";
import { recentEvents, recentSyncs } from "@/lib/ops";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireApiUser("orders.view");
    const events = recentEvents(30);
    const syncs = recentSyncs(20);
    return Response.json({ events, syncs });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
