import type { NextRequest } from "next/server";
import { z } from "zod";
import { readCustomerSession, accountByEmail, verifyPassword, setPassword } from "@/lib/accounts";
import { rateLimit } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

const schema = z.object({
  current: z.string().min(1).max(200).optional().default(""),
  next: z.string().min(8, "New password needs at least 8 characters.").max(200),
});

/** POST — change or set the customer's password.
 *  Accounts that already have one must present it; Google-only accounts may set one
 *  without (Google already proved mailbox ownership). */
export async function POST(req: NextRequest) {
  try {
    const session = await readCustomerSession();
    if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
    if (!rateLimit(`passwd:${session.email}`, 5, 15 * 60_000)) {
      return Response.json({ error: "Too many attempts — wait fifteen minutes." }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid password request." }, { status: 422 });

    const acc = accountByEmail(session.email);
    if (!acc) return Response.json({ error: "Account not found." }, { status: 404 });

    if (acc.passwordHash) {
      if (!parsed.data.current || !verifyPassword(acc, parsed.data.current)) {
        logEvent({ source: "API", level: "WARN", type: "account_change", path: "/api/account/password", message: "Wrong current password on change" });
        return Response.json({ error: "Current password is incorrect." }, { status: 403 });
      }
      if (parsed.data.current === parsed.data.next) {
        return Response.json({ error: "The new password must be different." }, { status: 422 });
      }
    }

    setPassword(acc.email, parsed.data.next);
    logEvent({ source: "API", level: "INFO", type: "account_change", path: "/api/account/password", message: "Password updated" });
    return Response.json({ ok: true });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/account/password", message: err instanceof Error ? err.message : "password crash" });
    return Response.json({ error: "Password change hit a snag. Try again." }, { status: 500 });
  }
}
