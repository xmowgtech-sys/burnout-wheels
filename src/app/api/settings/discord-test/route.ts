import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { resolveDiscordWebhooks } from "@/lib/settings";
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

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        content: `🧪 **Burnout Wheels test** — the ${parsed.data.target} webhook is connected.`,
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `Discord ${parsed.data.target} test`,
            description: "If you can read this inside the right channel, new orders will land here too.",
            color: 3066993,
            footer: { text: `Burnout Wheels · ${siteUrl()}` },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

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
