import { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string
      role?: string
      permissions?: string[]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    permissions?: string[]
  }
}
