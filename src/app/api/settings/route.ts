import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveSettings, getStorefront, getTrustpilot } from "@/lib/settings";
import { getPayments, setPayments } from "@/lib/razorpay";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { logActivity } from "@/lib/analytics";
import { storefrontSettingsSchema, trustpilotSettingsSchema } from "@/lib/validation";

/** GET — current settings bundle (settings.manage). Secrets are never echoed. */
export async function GET() {
  try {
    await requireApiUser("settings.manage");
    const pay = getPayments();
    return Response.json({
      storefront: getStorefront(),
      trustpilot: getTrustpilot(),
      payments: { keyId: pay?.razorpayKeyId ?? "", upiVpa: pay?.upiVpa ?? "", secretSet: Boolean(pay) },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const paymentsSchema = z.object({
  razorpayKeyId: z.string().trim().max(80),
  razorpayKeySecret: z.string().trim().max(120),
  upiVpa: z.string().trim().max(80),
});

/** PATCH ?key=storefront|trustpilot|payments — validated merge. */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("settings.manage");
    const key = req.nextUrl.searchParams.get("key") ?? "storefront";
    const raw = (await req.json()) as Record<string, unknown>;

    if (key === "payments") {
      const parsed = paymentsSchema.safeParse(raw);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 422 });
      const prev = getPayments();
      const secret = parsed.data.razorpayKeySecret || prev?.razorpayKeySecret || "";
      // Both gateway keys unset → drop the config entirely (manual UPI fallback stays via upiVpa)
      if (!parsed.data.razorpayKeyId && !secret) saveSettings("payments", { upiVpa: parsed.data.upiVpa });
      else setPayments({ razorpayKeyId: parsed.data.razorpayKeyId, razorpayKeySecret: secret, upiVpa: parsed.data.upiVpa });
      logActivity(me.email, "settings.update", "settings", "payments");
      return Response.json({ ok: true });
    }

    const schema =
      key === "storefront" ? storefrontSettingsSchema : key === "trustpilot" ? trustpilotSettingsSchema : null;
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
