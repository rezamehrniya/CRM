import { getDefaultPermissionsForRole, normalizeRoleKey } from './permissions.constants';

export type PermissionActor =
  | {
      role?: string | null;
      permissions?: string[] | null;
    }
  | undefined
  | null;

const ADMIN_FALLBACK_ROLES = new Set(['OWNER', 'ADMIN']);
const ROLE_FALLBACK_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER', 'SALES_MANAGER', 'SALES_REP', 'VIEWER']);

export function hasPermission(actor: PermissionActor, permission: string): boolean {
  if (!actor) return false;
  if (Array.isArray(actor.permissions) && actor.permissions.includes(permission)) return true;
  const rawRole = String(actor.role ?? '')
    .trim()
    .toUpperCase();

  if (ADMIN_FALLBACK_ROLES.has(rawRole)) return true;
  if (!ROLE_FALLBACK_ROLES.has(rawRole)) return false;

  const normalized = normalizeRoleKey(rawRole);
  const fallbackPermissions: string[] = getDefaultPermissionsForRole(normalized);
  return fallbackPermissions.includes(permission);
}

export function hasAllPermissions(actor: PermissionActor, permissions: string[]): boolean {
  return permissions.every((permission) => hasPermission(actor, permission));
}

export function hasAnyPermission(actor: PermissionActor, permissions: string[]): boolean {
  return permissions.some((permission) => hasPermission(actor, permission));
}
