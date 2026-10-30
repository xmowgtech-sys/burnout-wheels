import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "bw_session";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    return new TextEncoder().encode("burnout-dev-secret-do-not-use-in-prod-rotate-me");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE)?.value;

  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secretKey());
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (pathname === "/admin/login") {
    if (valid) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (!valid) {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
