import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/features/auth/auth.config";
import { rateLimitOrReject, RATE_LIMIT_AUTH, RATE_LIMIT_API, getClientIp } from "@/lib/security/rate-limit";

const { auth } = NextAuth(authConfig);

const PUBLIC = ["/login", "/register", "/reset-password", "/invite"];
const API_PUBLIC = ["/api/auth", "/api/health"];

// Auth-specific paths that get stricter limits
const AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/signin"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  const isApiPublic = API_PUBLIC.some((p) => path.startsWith(p));

  // Rate limit auth endpoints (stricter)
  if (AUTH_PATHS.some((p) => path.startsWith(p))) {
    const rl = rateLimitOrReject(req, RATE_LIMIT_AUTH, "auth");
    if (rl) return rl;
  }

  // Rate limit other API endpoints (moderate)
  if (path.startsWith("/api/") && !isApiPublic) {
    const rl = rateLimitOrReject(req, RATE_LIMIT_API, "api");
    if (rl) return rl;
  }

  if (!isLoggedIn && !isPublic && !isApiPublic) {
    const cb = encodeURIComponent(path + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${cb}`, nextUrl.origin));
  }

  if (isLoggedIn && isPublic && path === "/login") {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
