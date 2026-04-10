import { query } from './db';
import redis from './redis';

// ============ TIPOS ============

export interface UserPermissions {
  role: string;
  permissions: string[];
}

// ============ MAPA RUTA -> PERMISO ============

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

// ============ QUERIES ============

const CACHE_PREFIX = 'perms:';
const CACHE_TTL = 300; // 5 minutos

/**
 * Obtiene rol y permisos de un usuario por email.
 * - Primero intenta Redis cache
 * - Si no hay fila en user_roles, auto-asigna admin (primer usuario) u operator
 */
export async function getUserPermissions(email: string): Promise<UserPermissions> {
  // 1. Intentar cache
  try {
    const cached = await redis.get(`${CACHE_PREFIX}${email}`);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis down — continuar sin cache
  }

  // 2. Buscar en DB
  let result = await query(
    `SELECT r.name AS role, ARRAY_AGG(p.key) AS permissions
     FROM dashboard.user_roles ur
     JOIN dashboard.roles r ON r.id = ur.role_id
     JOIN dashboard.role_permissions rp ON rp.role_id = r.id
     JOIN dashboard.permissions p ON p.id = rp.permission_id
     WHERE ur.email = $1
     GROUP BY r.name`,
    [email]
  );

  if (result.rows.length > 0) {
    const perms: UserPermissions = {
      role: result.rows[0].role,
      permissions: result.rows[0].permissions,
    };
    await cachePermissions(email, perms);
    return perms;
  }

  // 3. Auto-assign: primer usuario sin rol = admin, resto = operator
  const countResult = await query('SELECT COUNT(*) FROM dashboard.user_roles');
  const isFirstUser = parseInt(countResult.rows[0].count, 10) === 0;
  const defaultRole = isFirstUser ? 'admin' : 'operator';

  await query(
    `INSERT INTO dashboard.user_roles (email, role_id)
     SELECT $1, id FROM dashboard.roles WHERE name = $2
     ON CONFLICT (email) DO NOTHING`,
    [email, defaultRole]
  );

  // Re-fetch con el rol asignado
  result = await query(
    `SELECT r.name AS role, ARRAY_AGG(p.key) AS permissions
     FROM dashboard.user_roles ur
     JOIN dashboard.roles r ON r.id = ur.role_id
     JOIN dashboard.role_permissions rp ON rp.role_id = r.id
     JOIN dashboard.permissions p ON p.id = rp.permission_id
     WHERE ur.email = $1
     GROUP BY r.name`,
    [email]
  );

  const perms: UserPermissions = {
    role: result.rows[0].role,
    permissions: result.rows[0].permissions,
  };
  await cachePermissions(email, perms);
  return perms;
}

// ============ CACHE ============

async function cachePermissions(email: string, perms: UserPermissions) {
  try {
    await redis.set(`${CACHE_PREFIX}${email}`, JSON.stringify(perms), 'EX', CACHE_TTL);
  } catch {
    // Redis down — silenciar
  }
}

export async function invalidatePermissionsCache(email: string) {
  try {
    await redis.del(`${CACHE_PREFIX}${email}`);
  } catch {
    // Redis down — silenciar
  }
}

// ============ HELPERS ============

export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/**
 * Dado un pathname, retorna el permiso requerido.
 * Para sub-rutas (ej: /analytics/monitoreo) busca la ruta base.
 */
export function getRequiredPermission(pathname: string): string | null {
  // Match exacto
  if (ROUTE_PERMISSION_MAP[pathname]) {
    return ROUTE_PERMISSION_MAP[pathname];
  }
  // Match por prefijo (ej: /analytics/algo -> page:analytics)
  for (const [route, perm] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (route !== '/' && pathname.startsWith(route)) {
      return perm;
    }
  }
  return null;
}
