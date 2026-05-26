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
    async jwt({ token, user, account }) {
      if (user) {
        token.image = user.image;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
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
        // Apuntar a nuestra ruta de API proxy local pasando el email para evitar caché cruzada en el navegador
        session.user.image = token.email 
          ? `/api/user/photo?email=${encodeURIComponent(token.email as string)}`
          : "/api/user/photo";
        (session as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
})