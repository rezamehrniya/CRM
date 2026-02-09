import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const SALT_ROUNDS = 10;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(tenant: TenantContext) {
    return this.prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: {
          select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true },
        },
      },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * افزودن عضو: شماره تلفن + نام و نام خانوادگی الزامی است.
   */
  async addMember(
    tenant: TenantContext,
    body: { phone: string; password: string; role?: string; firstName?: string | null; lastName?: string | null; email?: string | null },
  ) {
    const phone = body.phone?.trim();
    const password = body.password?.trim();
    const firstName = body.firstName?.trim() || null;
    const lastName = body.lastName?.trim() || null;
    if (!phone) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'شماره تلفن الزامی است.' });
    }
    if (!password || password.length < 8) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'رمز عبور اولیه حداقل ۸ کاراکتر باشد.',
      });
    }
    if (!firstName || !lastName) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'نام و نام خانوادگی الزامی است.',
      });
    }
    const role = body.role === 'OWNER' ? 'OWNER' : 'MEMBER';

    let user = await this.prisma.user.findFirst({
      where: { phone, status: 'ACTIVE' },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      user = await this.prisma.user.create({
        data: {
          phone,
          firstName,
          lastName,
          email: body.email?.trim() || null,
          passwordHash,
          status: 'ACTIVE',
        },
      });
    } else {
      const updateData: { passwordHash?: string; firstName?: string | null; lastName?: string | null; email?: string | null } = {};
      if (!user.passwordHash) {
        updateData.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      }
      if (user.firstName == null || user.lastName == null) {
        updateData.firstName = firstName;
        updateData.lastName = lastName;
        if (body.email !== undefined) updateData.email = body.email?.trim() || null;
      }
      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    const existing = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'این شماره تلفن قبلاً به سازمان اضافه شده است.',
      });
    }

    await this.prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role,
        status: 'ACTIVE',
      },
    });

    return { ok: true, userId: user.id };
  }
}
