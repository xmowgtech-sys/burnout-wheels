import type { NextRequest } from "next/server";
import { z } from "zod";
import { consumeOtp, accountByEmail, createCustomerSession, touchLogin } from "@/lib/accounts";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";
import { getDb, run } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const ip = ipOf(req);
    if (!rateLimit(`otp-login:${ip}`, 10, 10 * 60_000)) {
      return Response.json({ error: "Too many login attempts. Please wait 10 minutes." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = z.object({
      email: z.string().trim().email(),
      code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits."),
    }).safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Please provide email and 6-digit code." }, { status: 422 });
    }

    const email = parsed.data.email.toLowerCase();
    const verifiedEmail = consumeOtp(parsed.data.code);

    if (!verifiedEmail || verifiedEmail.toLowerCase() !== email) {
      logEvent({
        source: "API",
        level: "WARN",
        type: "otp_fail",
        path: "/api/auth/otp/login",
        message: `Invalid or expired OTP attempt for ${email}`,
      });
      return Response.json({ error: "Invalid or expired 6-digit code. Please request a new code." }, { status: 400 });
    }

    const acc = accountByEmail(email);
    if (!acc) {
      return Response.json({ error: "Account could not be found." }, { status: 404 });
    }

    // Verify account if not already verified
    if (!acc.verified) {
      run(getDb().prepare("UPDATE accounts SET verified = 1 WHERE email = ?"), email);
      acc.verified = true;
    }

    touchLogin(acc.id);
    await createCustomerSession(acc);

    logEvent({
      source: "API",
      level: "INFO",
      type: "otp_login_success",
      path: "/api/auth/otp/login",
      message: `Customer signed in via OTP: ${email}`,
    });

    return Response.json({
      ok: true,
      name: acc.name ?? acc.email,
    });
  } catch (err) {
    logEvent({
      source: "API",
      level: "ERROR",
      type: "api_fail",
      path: "/api/auth/otp/login",
      message: err instanceof Error ? err.message : "otp login crash",
    });
    return Response.json({ error: "Sign-in hit an unexpected snag. Try again." }, { status: 500 });
  }
}
