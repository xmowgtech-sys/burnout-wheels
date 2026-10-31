import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { tryGoogleLogin, createCustomerSession } from "@/lib/accounts";
import { logEvent } from "@/lib/ops";

/** GET — OAuth callback. Verifies state (CSRF), exchanges the code for tokens,
 *  loads the verified Google profile, then:
 *  - admin entry → signs into the team account with that email (must exist & be active)
 *  - store entry → creates/attaches a customer account (Google emails are pre-verified) */
export async function GET(req: NextRequest) {
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !state || !clientId || !clientSecret) {
    return Response.redirect(`${origin}/login?google=failed`, 302);
  }

  let scope = "store";
  let back: string | null = null;
  try {
    const { payload } = await jwtVerify(
      state,
      new TextEncoder().encode(`${process.env.SESSION_SECRET ?? "burnout-dev-secret-do-not-use-in-prod-rotate-me"}:oauth-state`)
    );
    scope = (payload.scope as string) === "admin" ? "admin" : "store";
    back = typeof payload.back === "string" ? payload.back : null;
  } catch {
    return Response.redirect(`${origin}/login?google=failed&reason=state`, 302);
  }

  // Exchange code → tokens (server-to-server; secrets never touch the browser).
  let idTokenEmail = "";
  let googleSub = "";
  let googleProfile: { name?: string; picture?: string } | undefined;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("no access_token");
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`profile fetch ${profileRes.status}`);
    const profile = (await profileRes.json()) as { sub?: string; email?: string; name?: string; picture?: string };
    if (!profile.email || !profile.sub) throw new Error("profile incomplete");
    idTokenEmail = profile.email.toLowerCase();
    googleSub = profile.sub;
    googleProfile = { name: profile.name, picture: profile.picture };
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/google/callback", message: `Google exchange failed: ${err instanceof Error ? err.message : "unknown"}` });
    return Response.redirect(`${origin}/login?google=failed`, 302);
  }

  if (scope === "admin") {
    // Team member must already exist with that email — OAuth never escalates strangers to staff.
    const db = getDb();
    const row = db.prepare("SELECT id, email, name, role, active, createdAt, lastLoginAt FROM users WHERE email = ?").get(idTokenEmail) as
      | { id: number; email: string; name: string; role: "OWNER" | "ADMIN" | "STAFF"; active: number; createdAt: string; lastLoginAt: string | null }
      | undefined;
    if (!row || row.active !== 1) {
      logEvent({ source: "API", level: "WARN", type: "login_fail", path: "/api/auth/google/callback", message: "Google sign-in attempt for non-admin address" });
      return Response.redirect(`${origin}/admin/login?google=no_admin`, 302);
    }
    await createSession({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      active: true,
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt,
    });
    return Response.redirect(`${origin}/admin`, 302);
  }

  const acc = tryGoogleLogin(idTokenEmail, googleSub, googleProfile);
  if (!acc) return Response.redirect(`${origin}/login?google=failed`, 302);
  await createCustomerSession(acc);
  return Response.redirect(`${origin}${back ?? "/account"}`, 302);
}
