import type { NextAuthConfig } from "next-auth"
import { getRequiredPermission } from "./lib/permissions"

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");
      const isPublicRoute = nextUrl.pathname.startsWith("/analytics/monitoreo") || nextUrl.pathname.startsWith("/api/db/monitoreo");

      if (isAuthRoute || isLoginPage || isPublicRoute) {
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      // Verificar permisos por ruta
      const requiredPerm = getRequiredPermission(nextUrl.pathname);
      if (requiredPerm) {
        const permissions = (auth as any)?.user?.permissions as string[] | undefined;
        if (permissions && !permissions.includes(requiredPerm)) {
          return Response.redirect(new URL('/', nextUrl.origin));
        }
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
