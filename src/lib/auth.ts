import NextAuth from "next-auth"
import Zoho from "next-auth/providers/zoho"
import { createClient } from '@supabase/supabase-js'
import { authConfig } from "../auth.config"
import { getUserPermissions } from "./permissions"

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpzfbpvtxrfyejoqjecu.supabase.co'
const BUCKET = 'chat-uploads'

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || '')
}

async function cacheAvatarOnLogin(
  email: string,
  accessToken: string,
  zohoImageUrl?: string | null
): Promise<string | null> {
  try {
    const avatarPath = `avatars/${email}`
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${avatarPath}`

    // Intentar obtener URL de imagen desde userinfo si no viene en el perfil
    let imageUrl = zohoImageUrl
    if (!imageUrl) {
      const infoRes = await fetch('https://accounts.zoho.com/oauth/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (infoRes.ok) {
        const info = await infoRes.json()
        imageUrl = info.picture || info.photo || null
      }
    }
    if (!imageUrl) return null

    // Descargar imagen (3 métodos de autenticación)
    let photoRes = await fetch(imageUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    })
    if (!photoRes.ok) {
      photoRes = await fetch(imageUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    }
    if (!photoRes.ok) photoRes = await fetch(imageUrl)
    if (!photoRes.ok) {
      console.error('[auth] No se pudo descargar avatar de Zoho, status:', photoRes.status)
      return null
    }

    const contentType = photoRes.headers.get('Content-Type') || 'image/jpeg'
    const buffer = Buffer.from(await photoRes.arrayBuffer())

    const { error } = await getSupabaseAdmin()
      .storage.from(BUCKET)
      .upload(avatarPath, buffer, { contentType, upsert: true })

    if (error) {
      console.error('[auth] Error subiendo avatar a Supabase:', error.message)
      return null
    }

    console.log(`[auth] Avatar cacheado en Supabase para ${email}`)
    return publicUrl
  } catch (err) {
    console.error('[auth] Error al cachear avatar en login:', err)
    return null
  }
}

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
      const domainsRaw = process.env.ZOHO_ORG_DOMAINS
      if (!domainsRaw) {
        console.warn("ZOHO_ORG_DOMAINS no definida. Bloqueando acceso.")
        return false
      }
      const allowedDomains = domainsRaw.split(",").map(d => d.trim().toLowerCase())
      if (user.email && allowedDomains.some(domain => user.email!.toLowerCase().endsWith(`@${domain}`))) {
        return true
      }
      return false
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.image = user.image
      }
      if (account) {
        token.accessToken = account.access_token as string
        // En el primer login: descargar foto de Zoho y cachear en Supabase
        if (token.email && account.access_token) {
          const cachedUrl = await cacheAvatarOnLogin(
            token.email as string,
            account.access_token as string,
            user?.image as string | null
          )
          if (cachedUrl) token.pictureUrl = cachedUrl
        }
      }
      if (token.email && !token.permissions) {
        try {
          const { role, permissions } = await getUserPermissions(token.email as string)
          token.role = role
          token.permissions = permissions
        } catch (err) {
          console.error("[auth] Error obteniendo permisos para", token.email, err)
          token.role = "operator"
          token.permissions = []
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub
      }
      if (session.user) {
        session.user.role = token.role
        session.user.permissions = token.permissions
        // Usar URL directa de Supabase (estable, sin expiración)
        // Fallback al proxy local si aún no hay URL cacheada
        session.user.image = token.pictureUrl ||
          (token.email
            ? `/api/user/photo?email=${encodeURIComponent(token.email as string)}`
            : '/api/user/photo')
        ;(session as any).accessToken = token.accessToken
      }
      return session
    },
  },
})
