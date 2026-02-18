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
          select: { id: true, email: true, phone: true, status: true },
        },
      },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * افزودن عضو با شماره تلفن — شماره تلفن به‌عنوان نام کاربری (برای ورود) استفاده می‌شود.
   */
  async addMember(
    tenant: TenantContext,
    body: { phone: string; password: string; role?: string },
  ) {
    const phone = body.phone?.trim();
    const password = body.password?.trim();
    if (!phone) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'شماره تلفن الزامی است.' });
    }
    if (!password || password.length < 8) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'رمز عبور اولیه حداقل ۸ کاراکتر باشد.',
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
          passwordHash,
          status: 'ACTIVE',
        },
      });
    } else if (!user.passwordHash) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
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
