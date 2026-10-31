import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountByEmail, createAccount, issueToken, issueOtp, nameOrigin } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";
import { sendMail, verificationMail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(60),
  password: z.string().min(8).max(200),
});

/** POST — customer signup. Passwords never stored in plain text (bcrypt, 10 rounds).
 *  Existing-but-unverified addresses get a new verification link instead of a duplicate row. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`signup:${ipOf(req)}`, 5, 60 * 60_000)) {
      return Response.json({ error: "Too many signups from this network — try again later." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0] === "password" ? "Password needs at least 8 characters." : "Enter a valid name and email.";
      return Response.json({ error: field }, { status: 422 });
    }
    const { email, name, password } = parsed.data;

    const existing = accountByEmail(email);
    if (existing) {
      if (!existing.verified) {
        const link = `${nameOrigin(req)}/api/auth/verify?token=${issueToken(existing.email, "VERIFY", 24 * 60 * 60_000)}`;
        if (rateLimit(`vresend:${existing.id}`, 2, 60 * 60_000)) await sendMail(verificationMail(email, name, link));
        return Response.json({ error: "This address is registered but unverified — a fresh verification link is on its way." }, { status: 409 });
      }
      return Response.json({ error: "That email already has an account — sign in instead (or use Google)." }, { status: 409 });
    }

    const acc = createAccount({ email, name, password });
    const link = `${nameOrigin(req)}/api/auth/verify?token=${issueToken(acc.email, "VERIFY", 24 * 60 * 60_000)}`;
    const code = issueOtp(acc.email);
    const sent = await sendMail(verificationMail(acc.email, name, link, code));
    logEvent({ source: "API", level: "INFO", type: "account_created", path: "/api/auth/signup", message: "Customer signed up", meta: `delivery=${sent.note}` });

    return Response.json({ ok: true, note: sent.delivered ? "Verification email sent." : "Account created — the verification link is waiting in the admin outbox until SMTP is configured." }, { status: 201 });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/signup", message: err instanceof Error ? err.message : "signup crash" });
    return Response.json({ error: "Signup hit a snag. Try again." }, { status: 500 });
  }
}
