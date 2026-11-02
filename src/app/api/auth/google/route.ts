import type { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { getAppOrigin } from "@/lib/auth";

/**
 * GET — kicks off Google OAuth 2.0. Shows an honest error when the deployment
 * hasn't been given client credentials yet (no fake "try Google" button behavior).
 * `?from=admin` marks the admin login entry point.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const from = req.nextUrl.searchParams.get("from") === "admin" ? "admin" : "store";
  const origin = getAppOrigin(req);

  if (!clientId || !clientSecret) {
    logOnce();
    return Response.redirect(`${origin}${from === "admin" ? "/admin/login?google=unconfigured" : "/login?google=unconfigured"}`, 302);
  }

  const back = req.nextUrl.searchParams.get("back");
  const state = await new SignJWT({ scope: from, back: back && back.startsWith("/") && !back.startsWith("//") ? back : null })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(`${process.env.SESSION_SECRET ?? "burnout-dev-secret-do-not-use-in-prod-rotate-me"}:oauth-state`));

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("access_type", "online");
  auth.searchParams.set("prompt", "select_account");
  auth.searchParams.set("state", state);

  return Response.redirect(auth.toString(), 302);
}

function logOnce() {
  console.warn("[burnout] Google sign-in requested but GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
}
