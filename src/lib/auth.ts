import NextAuth from "next-auth"
import Zoho from "next-auth/providers/zoho"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Zoho({
      clientId: process.env.ZOHO_CLIENT_ID,
      clientSecret: process.env.ZOHO_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Validamos que el dominio del correo coincida con el dominio de la organización
      const allowedDomain = process.env.ZOHO_ORG_DOMAIN;

      if (!allowedDomain) {
         console.warn("La variable ZOHO_ORG_DOMAIN no está definida en .env.local. Bloqueando acceso por seguridad.");
         return false; // Deniega el acceso si no hay dominio configurado
      }

      if (user.email && user.email.endsWith(`@${allowedDomain}`)) {
        return true; // Permite el inicio de sesión
      }

      return false; // Deniega cualquier otro correo
    },
    async session({ session, token }) {
      // Expone el ID del usuario en la sesión del cliente
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  }
})
