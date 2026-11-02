import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountByEmail, createAccount, issueOtp } from "@/lib/accounts";
import { sendMail, otpMail } from "@/lib/mailer";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

export async function POST(req: NextRequest) {
  try {
    const ip = ipOf(req);
    if (!rateLimit(`otp-send:${ip}`, 5, 10 * 60_000)) {
      return Response.json({ error: "Too many code requests. Please wait 10 minutes." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = z.object({
      email: z.string().trim().email("Please enter a valid email address."),
    }).safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 422 });
    }

    const email = parsed.data.email.toLowerCase();

    // Find or create account
    let acc = accountByEmail(email);
    if (!acc) {
      acc = createAccount({ email, verified: false });
    }

    const code = issueOtp(email);
    await sendMail(otpMail(email, code));

    logEvent({
      source: "API",
      level: "INFO",
      type: "otp_sent",
      path: "/api/auth/otp/send",
      message: `Login OTP issued for ${email}`,
    });

    return Response.json({
      ok: true,
      note: "A 6-digit verification code has been dispatched to your email.",
    });
  } catch (err) {
    logEvent({
      source: "API",
      level: "ERROR",
      type: "api_fail",
      path: "/api/auth/otp/send",
      message: err instanceof Error ? err.message : "otp send crash",
    });
    return Response.json({ error: "Failed to send code. Please try again." }, { status: 500 });
  }
}
