export { auth as middleware } from "@/lib/auth"

export const config = {
  // Proteger todas las rutas, EXCEPTO la API, estáticos, imágenes, el ícono y la página de login
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
}
