import NextAuth from "next-auth"
import Zoho from "next-auth/providers/zoho"
import { authConfig } from "../auth.config"
import { getUserPermissions } from "./permissions"

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
      const domainsRaw = process.env.ZOHO_ORG_DOMAINS;

      if (!domainsRaw) {
         console.warn("La variable ZOHO_ORG_DOMAINS no está definida en .env.local. Bloqueando acceso por seguridad.");
         return false;
      }

      const allowedDomains = domainsRaw.split(",").map(d => d.trim().toLowerCase());

      if (user.email && allowedDomains.some(domain => user.email!.toLowerCase().endsWith(`@${domain}`))) {
        return true;
      }

      return false;
    },
    async jwt({ token }) {
      if (token.email && !token.permissions) {
        try {
          const { role, permissions } = await getUserPermissions(token.email as string);
          token.role = role;
          token.permissions = permissions;
        } catch (err) {
          console.error("[auth] Error obteniendo permisos para", token.email, err);
          token.role = "operator";
          token.permissions = [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      if (session.user) {
        session.user.role = token.role;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
})
