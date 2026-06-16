import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/sw.js" ||
    pathname === "/firebase-messaging-sw.js" ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/) ||
    pathname.match(/\.[a-zA-Z0-9]+$/)
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get("session")?.value;

  const isLoginPage = pathname === "/login";
  const isRootPath = pathname === "/";

  // Allow root path to pass through - let page.tsx handle the redirect
  if (!session && !isLoginPage && !isRootPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next).*)"],
};
