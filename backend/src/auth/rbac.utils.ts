import { Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_KEYS,
  normalizeRoleKey,
} from './permissions.constants';

type RbacPrisma = PrismaClient | Prisma.TransactionClient | Record<string, unknown>;

type RoleSummary = {
  id: string;
  key: string;
  name: string;
};

type PermissionSummary = {
  id: string;
  key: string;
};

type RolePermissionSummary = {
  permissionId: string;
};

type MembershipSummary = {
  id: string;
  role: string;
};

export async function ensureTenantRbac(prisma: RbacPrisma, tenantId: string) {
  const db = prisma as any;

  // Backward compatibility:
  // if generated Prisma client does not include RBAC tables yet, skip sync gracefully.
  if (!db?.permission || !db?.role || !db?.rolePermission) {
    return { permissionIdByKey: new Map<string, string>(), roleByKey: new Map<string, RoleSummary>() };
  }

  try {
    const permissions: PermissionSummary[] = await Promise.all(
      PERMISSION_KEYS.map((key) =>
        db.permission.upsert({
          where: { key },
          update: {},
          create: { key },
          select: { id: true, key: true },
        }),
      ),
    );

    const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id] as const));
    const roleByKey = new Map<string, RoleSummary>();

    for (const roleDefinition of DEFAULT_ROLE_DEFINITIONS) {
      const role: RoleSummary = await db.role.upsert({
        where: { tenantId_key: { tenantId, key: roleDefinition.key } },
        update: {
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true,
        },
        create: {
          tenantId,
          key: roleDefinition.key,
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true,
        },
        select: { id: true, key: true, name: true },
      });
      roleByKey.set(role.key, role);

      const expectedPermissionIds = roleDefinition.permissions
        .map((key) => permissionIdByKey.get(key))
        .filter((permissionId): permissionId is string => Boolean(permissionId));

      const existingRolePermissions: RolePermissionSummary[] = await db.rolePermission.findMany({
        where: { roleId: role.id },
        select: { permissionId: true },
      });
      const existingPermissionIds = new Set(existingRolePermissions.map((entry) => entry.permissionId));

      const missingPermissionIds = expectedPermissionIds.filter(
        (permissionId) => !existingPermissionIds.has(permissionId),
      );

      if (missingPermissionIds.length > 0) {
        await db.rolePermission.createMany({
          data: missingPermissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        });
      }

      const expectedPermissionSet = new Set(expectedPermissionIds);
      const stalePermissionIds = existingRolePermissions
        .map((entry) => entry.permissionId)
        .filter((permissionId) => !expectedPermissionSet.has(permissionId));

      if (stalePermissionIds.length > 0) {
        await db.rolePermission.deleteMany({
          where: { roleId: role.id, permissionId: { in: stalePermissionIds } },
        });
      }
    }

    const memberships: MembershipSummary[] = await db.membership.findMany({
      where: { tenantId },
      select: { id: true, role: true },
    });

    for (const membership of memberships) {
      const roleKey = normalizeRoleKey(membership.role);
      if (membership.role !== roleKey) {
        await db.membership.update({
          where: { id: membership.id },
          data: { role: roleKey },
        });
      }
    }

    return { permissionIdByKey, roleByKey };
  } catch {
    return { permissionIdByKey: new Map<string, string>(), roleByKey: new Map<string, RoleSummary>() };
  }
}
