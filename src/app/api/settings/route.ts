import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  saveSettings,
  getStorefront,
  getTrustpilot,
  getDiscord,
  resolveDiscordWebhooks,
} from "@/lib/settings";
import { getPayments, setPayments } from "@/lib/razorpay";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { logActivity } from "@/lib/analytics";
import { ensureCatalogHydrated, persistCatalogSnapshot } from "@/lib/catalog-store";
import { discordSettingsSchema, storefrontSettingsSchema, trustpilotSettingsSchema } from "@/lib/validation";

/** GET — current settings bundle (settings.manage). Secrets are never echoed. */
export async function GET() {
  try {
    await requireApiUser("settings.manage");
    await ensureCatalogHydrated();
    const pay = getPayments();
    const savedDiscord = getDiscord();
    const effective = resolveDiscordWebhooks();
    return Response.json({
      storefront: getStorefront(),
      trustpilot: getTrustpilot(),
      payments: { keyId: pay?.razorpayKeyId ?? "", upiVpa: pay?.upiVpa ?? "", secretSet: Boolean(pay) },
      discord: {
        ...savedDiscord,
        effectiveBilling: effective.billing,
        effectiveAdmin: effective.admin,
        envBilling: Boolean(
          process.env.DISCORD_BILLING_WEBHOOK_URL?.trim() ||
            process.env.DISCORD_ORDERS_WEBHOOK_URL?.trim() ||
            process.env.DISCORD_WEBHOOK_URL?.trim()
        ),
        envAdmin: Boolean(
          process.env.DISCORD_ADMIN_WEBHOOK_URL?.trim() ||
            process.env.DISCORD_ORDERS_WEBHOOK_URL?.trim() ||
            process.env.DISCORD_WEBHOOK_URL?.trim()
        ),
      },
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

/** PATCH ?key=storefront|trustpilot|payments|discord — validated merge. */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("settings.manage");
    const key = req.nextUrl.searchParams.get("key") ?? "storefront";
    const raw = (await req.json()) as Record<string, unknown>;

    // Settings live in the same durable snapshot as the catalog. Refuse the
    // write when the snapshot cannot be read, otherwise a cold instance would
    // replace the owner's live settings with its bootstrap defaults.
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json(
        { error: "The durable settings store is unavailable — nothing was changed. Try again in a minute." },
        { status: 503 }
      );
    }

    if (key === "payments") {
      const parsed = paymentsSchema.safeParse(raw);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 422 });
      const prev = getPayments();
      const secret = parsed.data.razorpayKeySecret || prev?.razorpayKeySecret || "";
      // Both gateway keys unset → drop the config entirely (manual UPI fallback stays via upiVpa)
      if (!parsed.data.razorpayKeyId && !secret) saveSettings("payments", { upiVpa: parsed.data.upiVpa });
      else setPayments({ razorpayKeyId: parsed.data.razorpayKeyId, razorpayKeySecret: secret, upiVpa: parsed.data.upiVpa });
      await persistCatalogSnapshot({ hydrated: true });
      logActivity(me.email, "settings.update", "settings", "payments");
      return Response.json({ ok: true });
    }

    const schema =
      key === "storefront"
        ? storefrontSettingsSchema
        : key === "trustpilot"
          ? trustpilotSettingsSchema
          : key === "discord"
            ? discordSettingsSchema
            : null;
    if (!schema) return Response.json({ error: "Unknown settings key" }, { status: 400 });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 422 });
    saveSettings(key, parsed.data as Record<string, unknown>);
    await persistCatalogSnapshot({ hydrated: true });
    logActivity(me.email, "settings.update", "settings", key);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
