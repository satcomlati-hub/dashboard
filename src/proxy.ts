import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const session = await auth()

  const isLoginPage = request.nextUrl.pathname === "/login"
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth")

  // Allow auth routes and login page always
  if (isAuthRoute || isLoginPage) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to login
  if (!session) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
