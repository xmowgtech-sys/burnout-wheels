import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountByEmail, createCustomerSession, verifyPassword, touchLogin, issueToken, issueOtp, nameOrigin } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";
import { sendMail, verificationMail } from "@/lib/mailer";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

/** POST — customer email+password login. Unverified accounts are held back and get a fresh verification link. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`clogin:${ipOf(req)}`, 10, 10 * 60_000)) {
      logEvent({ source: "API", level: "WARN", type: "login_fail", path: "/api/auth/login", message: "Customer login rate limit hit" });
      return Response.json({ error: "Too many attempts — wait ten minutes." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid email and password." }, { status: 422 });
    const { email, password } = parsed.data;

    const acc = accountByEmail(email);
    if (!acc || !verifyPassword(acc, password)) {
      logEvent({ source: "API", level: "WARN", type: "login_fail", path: "/api/auth/login", message: "Failed customer sign-in" });
      return Response.json({ error: "Wrong email or password." }, { status: 401 });
    }

    if (!acc.verified) {
      if (rateLimit(`vresend:${acc.id}`, 2, 60 * 60_000)) {
        const link = `${nameOrigin(req)}/api/auth/verify?token=${issueToken(acc.email, "VERIFY", 24 * 60 * 60_000)}`;
        const code = issueOtp(acc.email);
        await sendMail(verificationMail(acc.email, acc.name ?? "", link, code));
      }
      return Response.json({ error: "This address isn't verified yet — a fresh verification link AND 6-digit code are on their way. Check your inbox.", stage: "verify" }, { status: 403 });
    }

    touchLogin(acc.id);
    await createCustomerSession(acc);
    return Response.json({ ok: true, name: acc.name ?? acc.email });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/login", message: err instanceof Error ? err.message : "login crash" });
    return Response.json({ error: "Sign-in hit a snag. Try again." }, { status: 500 });
  }
}
