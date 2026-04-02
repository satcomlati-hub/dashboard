import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const session = await auth()

  const isLoginPage = request.nextUrl.pathname === "/login"
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth")
  const isPublicRoute = request.nextUrl.pathname.startsWith("/analytics/monitoreo") || request.nextUrl.pathname.startsWith("/api/db/monitoreo")

  // Permite rutas públicas, de autenticación y la página de login
  if (isAuthRoute || isLoginPage || isPublicRoute) {
    return NextResponse.next()
  }

  // Redirige a los usuarios no autenticados al login
  if (!session) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
