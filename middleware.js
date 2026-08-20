import { NextResponse } from "next/server";

// Public paths that don't require auth
const PUBLIC = ["/login", "/api/auth"];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow Next internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("cs_auth")?.value;
  const expected = process.env.ACCESS_CODE || "";

  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  // For API calls, return 401 JSON; for pages, redirect to /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
