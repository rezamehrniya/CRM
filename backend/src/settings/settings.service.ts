import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';
import {
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_KEYS,
  getDefaultPermissionsForRole,
  getDefaultRoleDefinition,
  normalizeRoleKey,
} from '../auth/permissions.constants';
import { ensureTenantRbac } from '../auth/rbac.utils';

const SALT_ROUNDS = 10;

type AddMemberInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  roleKey?: string;
};

type ResolvedRole = {
  id: string | null;
  key: string;
  name: string;
};

type RoleWithPermissions = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  _count: { memberships: number };
  permissions: Array<{ permission: { key: string } }>;
};

function cleanText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma as any;
  }

  private hasRbacDelegates() {
    return Boolean(this.db?.role && this.db?.permission && this.db?.rolePermission);
  }

  private async resolveRole(tenantId: string, roleKey?: string | null): Promise<ResolvedRole> {
    await ensureTenantRbac(this.prisma, tenantId);

    const normalized = normalizeRoleKey(roleKey);
    const fallback = getDefaultRoleDefinition(normalized);

    if (!this.hasRbacDelegates()) {
      return { id: null, key: fallback.key, name: fallback.name };
    }

    let role: { id: string; key: string; name: string } | null = null;
    try {
      role = await this.db.role.findUnique({
        where: { tenantId_key: { tenantId, key: normalized } },
        select: { id: true, key: true, name: true },
      });
    } catch {
      role = null;
    }

    if (!role) {
      return { id: null, key: fallback.key, name: fallback.name };
    }

    return role;
  }

  async listPermissions(_tenant: TenantContext) {
    const baseRows = PERMISSION_KEYS.map((key) => {
      const [resource, action] = key.split('.');
      return {
        id: key,
        key,
        resource,
        action,
        description: null as string | null,
      };
    });

    if (!this.hasRbacDelegates()) return baseRows;

    let permissions: Array<{ id: string; key: string; description: string | null }> = [];
    try {
      permissions = await this.db.permission.findMany({
        where: { key: { in: [...PERMISSION_KEYS] } },
        select: { id: true, key: true, description: true },
      });
    } catch {
      return baseRows;
    }
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission] as const));

    return PERMISSION_KEYS.map((key) => {
      const permission = permissionByKey.get(key);
      const [resource, action] = key.split('.');
      return {
        id: permission?.id ?? key,
        key,
        resource,
        action,
        description: permission?.description ?? null,
      };
    });
  }

  async listRoles(tenant: TenantContext) {
    await ensureTenantRbac(this.prisma, tenant.id);
    const roleOrder = new Map(DEFAULT_ROLE_DEFINITIONS.map((role, index) => [role.key, index] as const));

    const fallbackRoles = async () => {
      const memberships = await this.prisma.membership.findMany({
        where: { tenantId: tenant.id },
        select: { role: true },
      });
      const memberCountByRole = new Map<string, number>();
      memberships.forEach((membership) => {
        const key = normalizeRoleKey(membership.role);
        memberCountByRole.set(key, (memberCountByRole.get(key) ?? 0) + 1);
      });

      return DEFAULT_ROLE_DEFINITIONS.map((role) => ({
        id: role.key,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
        memberCount: memberCountByRole.get(role.key) ?? 0,
        permissions: [...role.permissions].sort(),
      }));
    };

    if (!this.hasRbacDelegates()) {
      return fallbackRoles();
    }

    let roles: RoleWithPermissions[] = [];
    try {
      roles = await this.db.role.findMany({
        where: { tenantId: tenant.id },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          isSystem: true,
          _count: { select: { memberships: true } },
          permissions: {
            select: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      });
    } catch {
      return fallbackRoles();
    }

    return roles
      .map((role) => ({
        id: role.id,
        key: normalizeRoleKey(role.key),
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        memberCount: role._count.memberships,
        permissions: role.permissions.map((entry) => entry.permission.key).sort(),
      }))
      .sort((a, b) => {
        const aOrder = roleOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = roleOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.name.localeCompare(b.name);
      });
  }

  async listMembers(tenant: TenantContext) {
    await ensureTenantRbac(this.prisma, tenant.id);

    const memberships = await this.prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ id: 'asc' }],
    });

    const roleOrder = new Map(DEFAULT_ROLE_DEFINITIONS.map((role, index) => [role.key, index] as const));
    const roleMetaByKey = new Map<
      string,
      { id: string; key: string; name: string; permissions: string[] }
    >();

    if (this.hasRbacDelegates()) {
      try {
        const roles: RoleWithPermissions[] = await this.db.role.findMany({
          where: { tenantId: tenant.id },
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            isSystem: true,
            _count: { select: { memberships: true } },
            permissions: {
              select: {
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        });

        roles.forEach((role) => {
          const key = normalizeRoleKey(role.key);
          roleMetaByKey.set(key, {
            id: role.id,
            key,
            name: role.name,
            permissions: role.permissions.map((entry) => entry.permission.key).sort(),
          });
        });
      } catch {
        // Keep fallback role metadata.
      }
    }

    return memberships
      .map((membership) => {
        const roleKey = normalizeRoleKey(membership.role);
        const fallback = getDefaultRoleDefinition(roleKey);
        const roleMeta = roleMetaByKey.get(roleKey);

        return {
          id: membership.id,
          status: membership.status,
          role: {
            id: roleMeta?.id ?? null,
            key: roleKey,
            name: roleMeta?.name ?? fallback.name,
            permissions: roleMeta?.permissions ?? getDefaultPermissionsForRole(roleKey),
          },
          user: membership.user,
        };
      })
      .sort((a, b) => {
        const aOrder = roleOrder.get(a.role.key) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = roleOrder.get(b.role.key) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.id.localeCompare(b.id);
      });
  }

  async addMember(tenant: TenantContext, body: AddMemberInput) {
    const phone = cleanText(body.phone);
    const email = cleanText(body.email)?.toLowerCase();
    const firstName = cleanText(body.firstName);
    const lastName = cleanText(body.lastName);
    const password = cleanText(body.password);

    if (!phone && !email) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'ایمیل یا شماره تلفن الزامی است.',
      });
    }
    if (!password || password.length < 8) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'رمز عبور اولیه حداقل 8 کاراکتر باشد.',
      });
    }

    const role = await this.resolveRole(tenant.id, body.roleKey);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const lookupConditions = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ];

    let user = lookupConditions.length
      ? await this.prisma.user.findFirst({
          where: { OR: lookupConditions },
        })
      : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          phone,
          firstName,
          lastName,
          displayName:
            [firstName, lastName].filter((part): part is string => Boolean(part)).join(' ') || null,
          passwordHash,
          status: 'ACTIVE',
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: email ?? user.email,
          phone: phone ?? user.phone,
          firstName: firstName ?? user.firstName,
          lastName: lastName ?? user.lastName,
          displayName:
            [firstName ?? user.firstName, lastName ?? user.lastName]
              .filter((part): part is string => Boolean(part))
              .join(' ') || user.displayName,
          passwordHash,
          status: 'ACTIVE',
        },
      });
    }

    const existing = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'این کاربر قبلا به سازمان اضافه شده است.',
      });
    }

    const membership = await this.prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: role.key,
        status: 'ACTIVE',
      },
      select: { id: true, userId: true },
    });

    return {
      ok: true,
      membershipId: membership.id,
      userId: membership.userId,
      roleKey: role.key,
    };
  }

  async updateMemberRole(
    tenant: TenantContext,
    membershipId: string,
    roleKey?: string,
  ) {
    const role = await this.resolveRole(tenant.id, roleKey);

    const existing = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'عضو موردنظر پیدا نشد.',
      });
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: role.key },
    });

    return { ok: true };
  }
}
