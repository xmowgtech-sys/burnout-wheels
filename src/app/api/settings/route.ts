import { NextResponse, type NextRequest } from "next/server";
import { saveSettings, getStorefront, getChatbotSettings, getTrustpilot } from "@/lib/settings";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { logActivity } from "@/lib/analytics";
import { storefrontSettingsSchema, trustpilotSettingsSchema, chatSettingsSchema } from "@/lib/validation";

/** GET — current settings bundle (settings.manage). */
export async function GET() {
  try {
    await requireApiUser("settings.manage");
    return Response.json({
      storefront: getStorefront(),
      trustpilot: getTrustpilot(),
      chatbot: getChatbotSettings(),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?key=storefront|trustpilot|chatbot — validated merge. */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("settings.manage");
    const key = req.nextUrl.searchParams.get("key") ?? "storefront";
    const raw = (await req.json()) as Record<string, unknown>;
    const schema =
      key === "storefront" ? storefrontSettingsSchema : key === "trustpilot" ? trustpilotSettingsSchema : key === "chatbot" ? chatSettingsSchema : null;
    if (!schema) return Response.json({ error: "Unknown settings key" }, { status: 400 });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 422 });
    saveSettings(key, parsed.data);
    logActivity(me.email, "settings.update", "settings", key);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

void NextResponse;
