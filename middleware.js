import { NextResponse } from "next/server";

export function middleware(request) {
  const token = request.cookies.get("bjfa_admin_token")?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) {
    if (token) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
