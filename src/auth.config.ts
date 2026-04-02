import type { NextAuthConfig } from "next-auth"

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
      return true;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;
