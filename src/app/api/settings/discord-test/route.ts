import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { resolveDiscordWebhooks } from "@/lib/settings";
import { buildPublicDiscordOrderPayload } from "@/lib/notifications";
import { siteUrl } from "@/lib/site";

const bodySchema = z.object({
  target: z.enum(["billing", "admin"]),
  url: z.string().trim().max(500).optional().or(z.literal("")),
});

function isDiscordWebhookUrl(value: string): boolean {
  return /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i.test(value);
}

/** POST — deliver a test message so the owner can verify a pasted webhook. */
export async function POST(req: NextRequest) {
  try {
    await requireApiUser("settings.manage");
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Invalid test request" }, { status: 422 });

    const effective = resolveDiscordWebhooks();
    const supplied = parsed.data.url?.trim() ?? "";
    const webhookUrl = supplied || (parsed.data.target === "billing" ? effective.billing : effective.admin);
    if (!webhookUrl) {
      return Response.json(
        { error: `No ${parsed.data.target} webhook is configured yet. Paste one, save it, then test.` },
        { status: 400 }
      );
    }
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return Response.json(
        {
          error:
            "That is not a Discord webhook URL. It must look like https://discord.com/api/webhooks/123456789/abc… — a server invite link cannot receive messages.",
        },
        { status: 422 }
      );
    }

    const payload: Record<string, unknown> =
      parsed.data.target === "billing"
        ? buildPublicDiscordOrderPayload({
            orderNumber: "BW-TEST01-0Q",
            customerName: "Amanjot",
            totalMinor: 49900,
            units: 1,
            paymentMethod: "UPI",
            paymentChannel: "DISCORD",
            shippingMethod: "STANDARD",
            items: [{ name: "Red Bull Racing RB20 F1 (Test)", qty: 1, price: 49900, scale: "1:64" }],
            checkoutUrl: effective.checkoutUrl,
          })
        : {
            content: `🧪 **Burnout Wheels test** — the ${parsed.data.target} webhook is connected.`,
            allowed_mentions: { parse: [] },
            embeds: [
              {
                title: `Discord ${parsed.data.target} test`,
                description: "If you can read this inside the right channel, private admin order logs will land here.",
                color: 3066993,
                footer: { text: `Burnout Wheels · ${siteUrl()}` },
                timestamp: new Date().toISOString(),
              },
            ],
          };

    const postTest = (body: Record<string, unknown>) =>
      fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify(body),
      });

    let res = await postTest(payload);
    if (!res.ok && res.status === 400 && "components" in payload) {
      const { components: _ignored, ...fallback } = payload;
      void _ignored;
      res = await postTest(fallback);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        {
          error: `Discord returned ${res.status}. ${text.slice(0, 300) || "Check that the webhook still exists and belongs to this channel."}`,
          status: res.status,
          ok: false,
        },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, status: res.status });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
