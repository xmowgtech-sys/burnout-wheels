import type { NextRequest } from "next/server";
import { z } from "zod";
import { consumeToken, setPassword } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";

/** POST — completes a password reset: verifies the one-time token, upgrades the hash. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`resetset:${ipOf(req)}`, 10, 60 * 60_000)) {
      return Response.json({ error: "Too many attempts — try again later." }, { status: 429 });
    }
    const parsed = z.object({ token: z.string().min(10).max(100), password: z.string().min(8).max(200) }).safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.path[0] === "password" ? "Password needs at least 8 characters." : "Reset link is malformed.";
      return Response.json({ error: msg }, { status: 422 });
    }
    const email = consumeToken(parsed.data.token, "RESET");
    if (!email) return Response.json({ error: "This reset link expired or was already used — request a new one." }, { status: 400 });
    setPassword(email, parsed.data.password);
    return Response.json({ ok: true, note: "Password updated — sign in with the new one." });
  } catch (err) {
    console.error("[burnout] reset failed:", err);
    return Response.json({ error: "Reset failed — try again." }, { status: 500 });
  }
}
