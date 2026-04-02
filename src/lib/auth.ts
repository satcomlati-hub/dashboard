import NextAuth from "next-auth"
import Zoho from "next-auth/providers/zoho"
import { authConfig } from "../auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Zoho({
      clientId: process.env.ZOHO_CLIENT_ID,
      clientSecret: process.env.ZOHO_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const allowedDomain = process.env.ZOHO_ORG_DOMAIN;

      if (!allowedDomain) {
         console.warn("La variable ZOHO_ORG_DOMAIN no está definida en .env.local. Bloqueando acceso por seguridad.");
         return false; 
      }

      if (user.email && user.email.endsWith(`@${allowedDomain}`)) {
        return true; 
      }

      return false; 
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
})
