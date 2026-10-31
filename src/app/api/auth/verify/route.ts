import type { NextRequest } from "next/server";
import { consumeToken } from "@/lib/accounts";
import { getDb, run } from "@/lib/db";
import { createCustomerSession, accountByEmail } from "@/lib/accounts";
import { logEvent } from "@/lib/ops";

/** GET ?token=… — one-time email verification link. Verifies the account,
 *  signs the customer in, redirects to the account page. */
export async function GET(req: NextRequest) {
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return Response.redirect(`${origin}/verify?status=bad`, 302);
  }
  const email = consumeToken(token, "VERIFY");
  if (!email) return Response.redirect(`${origin}/verify?status=expired`, 302);

  run(getDb().prepare("UPDATE accounts SET verified = 1 WHERE email = ?"), email);
  logEvent({ source: "API", level: "INFO", type: "account_verified", path: "/api/auth/verify", message: "Customer email verified" });

  const acc = accountByEmail(email);
  if (acc) await createCustomerSession(acc);
  return Response.redirect(`${origin}/account?verified=1`, 302);
}
