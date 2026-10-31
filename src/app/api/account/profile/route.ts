import type { NextRequest } from "next/server";
import { z } from "zod";
import { readCustomerSession, accountByEmail, updateProfile } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(20).optional(),
});

/** PATCH — update the signed-in customer's profile (name, phone). Email stays the identity key. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await readCustomerSession();
    if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
    if (!rateLimit(`profile:${ipOf(req)}`, 20, 10 * 60_000)) {
      return Response.json({ error: "Too many updates — wait a few minutes." }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid name (max 60 chars) and phone." }, { status: 422 });

    const acc = accountByEmail(session.email);
    if (!acc) return Response.json({ error: "Account not found." }, { status: 404 });

    const updated = updateProfile(acc.email, parsed.data);
    logEvent({ source: "API", level: "INFO", type: "profile_update", path: "/api/account/profile", message: "Profile updated" });

    return Response.json({
      ok: true,
      account: updated
        ? { email: updated.email, name: updated.name, phone: updated.phone, picture: updated.picture, verified: updated.verified }
        : null,
    });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/account/profile", message: err instanceof Error ? err.message : "profile crash" });
    return Response.json({ error: "Profile update hit a snag. Try again." }, { status: 500 });
  }
}
