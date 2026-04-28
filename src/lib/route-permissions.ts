// Funciones puras de permisos — sin dependencias de DB/Redis.
// Seguro para Edge Runtime (middleware).

export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/': 'page:home',
  '/projects': 'page:projects',
  '/workflows': 'page:workflows',
  '/usage': 'page:usage',
  '/analytics': 'page:analytics',
  '/credentials': 'page:credentials',
  '/chat': 'page:chat',
  '/settings': 'page:settings',
};

export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/**
 * Dado un pathname, retorna el permiso requerido.
 * Para sub-rutas (ej: /analytics/monitoreo) busca la ruta base.
 */
export function getRequiredPermission(pathname: string): string | null {
  if (ROUTE_PERMISSION_MAP[pathname]) {
    return ROUTE_PERMISSION_MAP[pathname];
  }
  for (const [route, perm] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (route !== '/' && pathname.startsWith(route)) {
      return perm;
    }
  }
  return null;
}
