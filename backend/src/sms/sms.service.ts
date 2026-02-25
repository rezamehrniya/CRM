import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SmsStatus } from '@prisma/client';
import { normalizeRoleKey } from '../auth/permissions.constants';
import { hasPermission } from '../auth/permissions.utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';
import { SmsMockProviderService } from './sms-mock-provider.service';

type ActorContext = {
  userId: string;
  role: string;
  permissions?: string[];
};

type SmsScope = 'me' | 'team';

type SmsListArgs = {
  scope?: string;
  from?: string;
  to?: string;
  status?: string;
  createdByUserId?: string;
  page?: number;
  pageSize?: number;
};

type SingleSendArgs = {
  recipientPhone?: string;
  recipientName?: string;
  body?: string;
  templateId?: string;
};

type BulkSendArgs = {
  recipients?: Array<{ phone?: string; name?: string }>;
  body?: string;
  templateId?: string;
  campaignName?: string;
};

type SmsLogRow = Prisma.SmsLogGetPayload<{
  select: {
    id: true;
    senderLine: true;
    recipientPhone: true;
    recipientName: true;
    body: true;
    status: true;
    source: true;
    campaignKey: true;
    errorMessage: true;
    queuedAt: true;
    sentAt: true;
    deliveredAt: true;
    failedAt: true;
    createdByUserId: true;
    createdBy: {
      select: {
        firstName: true;
        lastName: true;
        displayName: true;
        email: true;
        phone: true;
      };
    };
    template: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

const FIXED_SENDER_LINE = 'Sakhtar';
const VALID_STATUSES = new Set<SmsStatus>(['QUEUED', 'SENT', 'DELIVERED', 'FAILED']);

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseDate(value?: string): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizePhone(value?: string | null): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function userLabel(user?: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
} | null): string {
  if (!user) return 'نامشخص';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email?.trim()) return user.email.trim();
  if (user.phone?.trim()) return user.phone.trim();
  return 'نامشخص';
}

@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockProvider: SmsMockProviderService,
  ) {}

  private canReadTeam(actor: ActorContext): boolean {
    if (hasPermission(actor, 'sms.team.read')) return true;
    const role = normalizeRoleKey(actor.role);
    return role === 'ADMIN' || role === 'SALES_MANAGER';
  }

  private canBulkSend(actor: ActorContext): boolean {
    if (hasPermission(actor, 'sms.bulk.send')) return true;
    const role = normalizeRoleKey(actor.role);
    return role === 'ADMIN' || role === 'SALES_MANAGER';
  }

  private resolveScope(requestedScope: string | undefined, actor: ActorContext): SmsScope {
    const wantsTeam = String(requestedScope ?? '').trim().toLowerCase() === 'team';
    if (wantsTeam && this.canReadTeam(actor)) return 'team';
    return 'me';
  }

  private normalizeStatus(status?: string): SmsStatus | null {
    const raw = String(status ?? '').trim().toUpperCase();
    if (!raw) return null;
    if (VALID_STATUSES.has(raw as SmsStatus)) return raw as SmsStatus;
    return null;
  }

  private async resolveMessage(tenantId: string, args: { body?: string; templateId?: string }) {
    const bodyText = String(args.body ?? '').trim();
    const templateId = String(args.templateId ?? '').trim();

    if (!templateId) {
      if (!bodyText) throw new BadRequestException('SMS_BODY_REQUIRED');
      return { body: bodyText, templateId: null as string | null };
    }

    const template = await this.prisma.smsTemplate.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true, body: true, isActive: true },
    });
    if (!template) throw new NotFoundException('SMS_TEMPLATE_NOT_FOUND');
    if (!template.isActive) throw new BadRequestException('SMS_TEMPLATE_INACTIVE');

    return {
      body: bodyText || template.body,
      templateId: template.id,
    };
  }

  private buildProviderMessageId(tenantId: string, creatorUserId: string): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `sms-${tenantId}-${creatorUserId}-${Date.now()}-${random}`;
  }

  private mapLog(row: SmsLogRow) {
    return {
      id: row.id,
      senderLine: row.senderLine,
      recipientPhone: row.recipientPhone,
      recipientName: row.recipientName,
      body: row.body,
      status: row.status,
      source: row.source,
      campaignKey: row.campaignKey,
      errorMessage: row.errorMessage,
      queuedAt: row.queuedAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      createdBy: {
        userId: row.createdByUserId,
        name: userLabel(row.createdBy),
      },
      template: row.template
        ? {
            id: row.template.id,
            name: row.template.name,
          }
        : null,
    };
  }

  async list(tenant: TenantContext, actor: ActorContext, args: SmsListArgs) {
    const scope = this.resolveScope(args.scope, actor);

    const page = clampInt(Number(args.page ?? 1), 1, 10_000);
    const pageSize = clampInt(Number(args.pageSize ?? 30), 1, 200);
    const skip = (page - 1) * pageSize;

    const where: Prisma.SmsLogWhereInput = { tenantId: tenant.id };
    if (scope === 'me') {
      where.createdByUserId = actor.userId;
    } else {
      const requestedCreator = String(args.createdByUserId ?? '').trim();
      if (requestedCreator) where.createdByUserId = requestedCreator;
    }

    const normalizedStatus = this.normalizeStatus(args.status);
    if (args.status && !normalizedStatus) {
      throw new BadRequestException('INVALID_SMS_STATUS');
    }
    if (normalizedStatus) where.status = normalizedStatus;

    const from = parseDate(args.from);
    const to = parseDate(args.to);
    if ((args.from && !from) || (args.to && !to)) {
      throw new BadRequestException('INVALID_DATE_RANGE');
    }
    if (from || to) {
      const start = from ?? new Date(0);
      const endRaw = to ?? new Date();
      const end = new Date(endRaw.getTime() + 24 * 60 * 60 * 1000 - 1);
      where.queuedAt = start.getTime() <= end.getTime() ? { gte: start, lte: end } : { gte: end, lte: start };
    }

    const [total, grouped, rows] = await Promise.all([
      this.prisma.smsLog.count({ where }),
      this.prisma.smsLog.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.smsLog.findMany({
        where,
        select: {
          id: true,
          senderLine: true,
          recipientPhone: true,
          recipientName: true,
          body: true,
          status: true,
          source: true,
          campaignKey: true,
          errorMessage: true,
          queuedAt: true,
          sentAt: true,
          deliveredAt: true,
          failedAt: true,
          createdByUserId: true,
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ queuedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);

    const counts: Record<SmsStatus, number> = {
      QUEUED: 0,
      SENT: 0,
      DELIVERED: 0,
      FAILED: 0,
    };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }

    const finalCount = counts.DELIVERED + counts.FAILED;
    const deliveryRatePct = finalCount > 0 ? (counts.DELIVERED / finalCount) * 100 : 0;
    const failureRatePct = finalCount > 0 ? (counts.FAILED / finalCount) * 100 : 0;

    return {
      scope,
      senderLine: FIXED_SENDER_LINE,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      summary: {
        total,
        queued: counts.QUEUED,
        sent: counts.SENT,
        delivered: counts.DELIVERED,
        failed: counts.FAILED,
        deliveryRatePct,
        failureRatePct,
      },
      items: rows.map((row) => this.mapLog(row)),
    };
  }

  async sendSingle(tenant: TenantContext, actor: ActorContext, args: SingleSendArgs) {
    const phone = normalizePhone(args.recipientPhone);
    if (!phone) throw new BadRequestException('INVALID_RECIPIENT_PHONE');

    const optOut = await this.prisma.smsOptOut.findUnique({
      where: { tenantId_phone: { tenantId: tenant.id, phone } },
      select: { id: true },
    });
    if (optOut) throw new ForbiddenException('RECIPIENT_OPTED_OUT');

    const resolved = await this.resolveMessage(tenant.id, args);
    const providerMessageId = this.buildProviderMessageId(tenant.id, actor.userId);

    const created = await this.prisma.smsLog.create({
      data: {
        tenantId: tenant.id,
        createdByUserId: actor.userId,
        senderLine: FIXED_SENDER_LINE,
        recipientPhone: phone,
        recipientName: String(args.recipientName ?? '').trim() || null,
        body: resolved.body,
        templateId: resolved.templateId,
        status: 'QUEUED',
        source: 'SINGLE',
        providerMessageId,
      },
      select: {
        id: true,
        senderLine: true,
        recipientPhone: true,
        recipientName: true,
        body: true,
        status: true,
        source: true,
        campaignKey: true,
        errorMessage: true,
        queuedAt: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        createdByUserId: true,
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.mockProvider.scheduleLifecycle(created.id);

    return {
      senderLine: FIXED_SENDER_LINE,
      item: this.mapLog(created),
    };
  }

  async sendBulk(tenant: TenantContext, actor: ActorContext, args: BulkSendArgs) {
    if (!this.canBulkSend(actor)) {
      throw new ForbiddenException('SMS_BULK_FORBIDDEN');
    }

    const recipients = Array.isArray(args.recipients) ? args.recipients : [];
    if (recipients.length === 0) throw new BadRequestException('BULK_RECIPIENTS_REQUIRED');
    if (recipients.length > 1000) throw new BadRequestException('BULK_RECIPIENTS_LIMIT_EXCEEDED');

    const resolved = await this.resolveMessage(tenant.id, args);
    const campaignName = String(args.campaignName ?? '').trim();
    const campaignKey = campaignName || `bulk-${Date.now()}`;

    const uniqueRecipients = new Map<string, { phone: string; name: string | null }>();
    let skippedInvalid = 0;
    for (const recipient of recipients) {
      const phone = normalizePhone(recipient?.phone);
      if (!phone) {
        skippedInvalid += 1;
        continue;
      }
      if (!uniqueRecipients.has(phone)) {
        uniqueRecipients.set(phone, {
          phone,
          name: String(recipient?.name ?? '').trim() || null,
        });
      }
    }

    const candidatePhones = Array.from(uniqueRecipients.keys());
    const optOutRows =
      candidatePhones.length > 0
        ? await this.prisma.smsOptOut.findMany({
            where: { tenantId: tenant.id, phone: { in: candidatePhones } },
            select: { phone: true },
          })
        : [];
    const optOutPhones = new Set(optOutRows.map((item) => item.phone));

    let skippedOptOut = 0;
    const payloads = Array.from(uniqueRecipients.values())
      .filter((recipient) => {
        if (optOutPhones.has(recipient.phone)) {
          skippedOptOut += 1;
          return false;
        }
        return true;
      })
      .map((recipient) => ({
        tenantId: tenant.id,
        createdByUserId: actor.userId,
        senderLine: FIXED_SENDER_LINE,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        body: resolved.body,
        status: 'QUEUED' as const,
        source: 'BULK',
        campaignKey,
        templateId: resolved.templateId,
        providerMessageId: this.buildProviderMessageId(tenant.id, actor.userId),
      }));

    const createdItems: Array<{ id: string }> = [];
    for (const payload of payloads) {
      const created = await this.prisma.smsLog.create({
        data: payload,
        select: { id: true },
      });
      createdItems.push(created);
      await this.mockProvider.scheduleLifecycle(created.id);
    }

    return {
      senderLine: FIXED_SENDER_LINE,
      campaignKey,
      requested: recipients.length,
      created: createdItems.length,
      skippedInvalid,
      skippedOptOut,
    };
  }

  async listTemplates(tenant: TenantContext, actor: ActorContext) {
    const manage = hasPermission(actor, 'sms.manage');
    const items = await this.prisma.smsTemplate.findMany({
      where: { tenantId: tenant.id, ...(manage ? {} : { isActive: true }) },
      select: {
        id: true,
        name: true,
        body: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    return {
      senderLine: FIXED_SENDER_LINE,
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async createTemplate(
    tenant: TenantContext,
    actor: ActorContext,
    body: { name?: string; body?: string; isActive?: boolean },
  ) {
    const name = String(body.name ?? '').trim();
    const text = String(body.body ?? '').trim();
    if (!name) throw new BadRequestException('SMS_TEMPLATE_NAME_REQUIRED');
    if (!text) throw new BadRequestException('SMS_TEMPLATE_BODY_REQUIRED');

    try {
      const created = await this.prisma.smsTemplate.create({
        data: {
          tenantId: tenant.id,
          name,
          body: text,
          isActive: body.isActive ?? true,
          createdByUserId: actor.userId,
        },
        select: {
          id: true,
          name: true,
          body: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('SMS_TEMPLATE_NAME_DUPLICATE');
      }
      throw error;
    }
  }

  async updateTemplate(
    tenant: TenantContext,
    templateId: string,
    body: { name?: string; body?: string; isActive?: boolean },
  ) {
    const existing = await this.prisma.smsTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('SMS_TEMPLATE_NOT_FOUND');

    const nextName =
      body.name !== undefined
        ? (() => {
            const value = String(body.name ?? '').trim();
            if (!value) throw new BadRequestException('SMS_TEMPLATE_NAME_REQUIRED');
            return value;
          })()
        : undefined;
    const nextBody =
      body.body !== undefined
        ? (() => {
            const value = String(body.body ?? '').trim();
            if (!value) throw new BadRequestException('SMS_TEMPLATE_BODY_REQUIRED');
            return value;
          })()
        : undefined;

    try {
      const updated = await this.prisma.smsTemplate.update({
        where: { id: existing.id },
        data: {
          ...(nextName !== undefined ? { name: nextName } : {}),
          ...(nextBody !== undefined ? { body: nextBody } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        },
        select: {
          id: true,
          name: true,
          body: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('SMS_TEMPLATE_NAME_DUPLICATE');
      }
      throw error;
    }
  }

  async deleteTemplate(tenant: TenantContext, templateId: string) {
    const deleted = await this.prisma.smsTemplate.deleteMany({
      where: { id: templateId, tenantId: tenant.id },
    });
    if (deleted.count === 0) throw new NotFoundException('SMS_TEMPLATE_NOT_FOUND');
    return { ok: true };
  }

  async listOptOuts(tenant: TenantContext) {
    const items = await this.prisma.smsOptOut.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        phone: true,
        reason: true,
        createdAt: true,
      },
    });
    return {
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async addOptOut(
    tenant: TenantContext,
    actor: ActorContext,
    body: { phone?: string; reason?: string },
  ) {
    const phone = normalizePhone(body.phone);
    if (!phone) throw new BadRequestException('INVALID_RECIPIENT_PHONE');
    const reason = String(body.reason ?? '').trim() || null;

    const upserted = await this.prisma.smsOptOut.upsert({
      where: {
        tenantId_phone: { tenantId: tenant.id, phone },
      },
      update: {
        reason,
        createdByUserId: actor.userId,
      },
      create: {
        tenantId: tenant.id,
        phone,
        reason,
        createdByUserId: actor.userId,
      },
      select: {
        id: true,
        phone: true,
        reason: true,
        createdAt: true,
      },
    });

    return {
      ...upserted,
      createdAt: upserted.createdAt.toISOString(),
    };
  }

  async removeOptOut(tenant: TenantContext, phoneParam: string) {
    const phone = normalizePhone(phoneParam);
    if (!phone) throw new BadRequestException('INVALID_RECIPIENT_PHONE');
    const deleted = await this.prisma.smsOptOut.deleteMany({
      where: { tenantId: tenant.id, phone },
    });
    if (deleted.count === 0) throw new NotFoundException('SMS_OPT_OUT_NOT_FOUND');
    return { ok: true };
  }
}
