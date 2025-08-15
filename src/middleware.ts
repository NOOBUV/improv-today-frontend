import { NextResponse } from "next/server";

export async function middleware() {
  // Simple pass-through middleware - Auth0 session handling is done at the route level
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"]
};
