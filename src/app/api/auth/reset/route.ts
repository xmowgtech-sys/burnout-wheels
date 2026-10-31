import type { NextRequest } from "next/server";
import { z } from "zod";
import { issueToken, accountByEmail, nameOrigin } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";
import { sendMail, resetMail } from "@/lib/mailer";

/** POST — asks for a reset link. Always answers the same (no account enumeration),
 *  and only emails real accounts. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`resetreq:${ipOf(req)}`, 5, 60 * 60_000)) {
      return Response.json({ error: "Too many reset requests — try again later." }, { status: 429 });
    }
    const parsed = z.object({ email: z.string().email() }).safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid email." }, { status: 422 });
    const email = parsed.data.email.trim().toLowerCase();

    const acc = accountByEmail(email);
    if (acc) {
      const link = `${nameOrigin(req)}/reset?token=${issueToken(email, "RESET", 60 * 60_000)}`;
      await sendMail(resetMail(email, link));
    }
    // Identical response either way.
    return Response.json({ ok: true, note: "If that address has an account, a reset link is on its way. Links expire in one hour." });
  } catch (err) {
    console.error("[burnout] reset request failed:", err);
    return Response.json({ error: "Reset request failed — try again." }, { status: 500 });
  }
}
