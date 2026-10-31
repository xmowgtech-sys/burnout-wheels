import type { NextRequest } from "next/server";
import { z } from "zod";
import { consumeOtp, accountByEmail, createCustomerSession, issueOtp } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";
import { sendMail, otpMail } from "@/lib/mailer";
import { run, getDb } from "@/lib/db";

/** POST — consume a 6-digit email-verification code and activate the account. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`otp-in:${ipOf(req)}`, 10, 10 * 60_000)) {
      return Response.json({ error: "Too many attempts — wait ten minutes." }, { status: 429 });
    }
    const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") }).safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Enter the 6-digit code from your email." }, { status: 422 });

    const email = consumeOtp(parsed.data.code);
    if (!email) {
      logEvent({ source: "API", level: "WARN", type: "verify_fail", path: "/api/auth/verify/otp", message: "Invalid or expired OTP" });
      return Response.json({ error: "That code is invalid or expired — request a fresh one below." }, { status: 403 });
    }

    const acc = accountByEmail(email);
    if (!acc) return Response.json({ error: "Account not found." }, { status: 404 });

    run(getDb().prepare("UPDATE accounts SET verified = 1 WHERE email = ?"), email);
    await createCustomerSession(accountByEmail(email)!);
    logEvent({ source: "API", level: "INFO", type: "account_verified", path: "/api/auth/verify/otp", message: "Customer email verified via OTP" });
    return Response.json({ ok: true, name: acc.name ?? acc.email });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/verify/otp", message: err instanceof Error ? err.message : "otp crash" });
    return Response.json({ error: "Verification hit a snag. Try again." }, { status: 500 });
  }
}

/** PUT — resend a fresh OTP to an existing unverified account (no login required;
 *  the response never reveals whether the address exists). */
export async function PUT(req: NextRequest) {
  try {
    if (!rateLimit(`otp-rs:${ipOf(req)}`, 3, 15 * 60_000)) {
      return Response.json({ error: "Too many requests — wait fifteen minutes." }, { status: 429 });
    }
    const parsed = z.object({ email: z.string().email() }).safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid email." }, { status: 422 });

    const acc = accountByEmail(parsed.data.email);
    if (acc && !acc.verified) {
      const code = issueOtp(acc.email);
      await sendMail(otpMail(acc.email, code));
    }
    // Same reply either way — stop address enumeration cold.
    return Response.json({ ok: true, note: "If that address needs verification, a fresh code is on its way." });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/verify/otp", message: err instanceof Error ? err.message : "otp resend crash" });
    return Response.json({ error: "Resend hit a snag. Try again." }, { status: 500 });
  }
}
