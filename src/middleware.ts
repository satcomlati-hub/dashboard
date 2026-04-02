import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const authMiddleware = NextAuth(authConfig).auth

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // BYPASS ESTRICTO ANTES DE NEXTAUTH:
  // Si la ruta es monitoreo o su api, retornamos de inmediato sin pasar por la validación
  // de NextAuth. Esto previene que una falla de entorno o secreto en NextAuth tumbe la petición.
  if (pathname.startsWith("/analytics/monitoreo") || pathname.startsWith("/api/db/monitoreo")) {
    return NextResponse.next()
  }

  // Dejamos que Next Auth maneje el resto de rutas (login, protecciones generales)
  return authMiddleware(request as any)
}

export const config = {
  // Ignoramos archivos estáticos y auth API
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
