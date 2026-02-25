import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStatus, Prisma } from '@prisma/client';
import { normalizeRoleKey } from '../auth/permissions.constants';
import { hasPermission } from '../auth/permissions.utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

type ActorContext = {
  userId: string;
  role: string;
  permissions?: string[];
};

type CallScope = 'me' | 'team';

type ListLogsArgs = {
  scope?: string;
  from?: string;
  to?: string;
  status?: string;
  hasRecording?: string;
  page?: number;
  pageSize?: number;
  agentUserId?: string;
};

const ACTIVE_CALL_STATUSES: CallStatus[] = ['RINGING', 'IN_PROGRESS', 'ANSWERED'];
const VALID_CALL_STATUSES = new Set<CallStatus>([
  'RINGING',
  'IN_PROGRESS',
  'ANSWERED',
  'MISSED',
  'FAILED',
  'ENDED',
]);
const AFTER_CALL_WORK_WINDOW_MS = 5 * 60 * 1000;

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

function parseDate(value?: string): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseBoolean(value?: string): boolean | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return null;
}

function normalizeStatus(value?: string): CallStatus | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (VALID_CALL_STATUSES.has(raw as CallStatus)) {
    return raw as CallStatus;
  }
  return null;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  private canReadTeam(actor: ActorContext): boolean {
    if (hasPermission(actor, 'calls.team.read')) return true;
    const role = normalizeRoleKey(actor.role);
    return role === 'ADMIN' || role === 'SALES_MANAGER';
  }

  private resolveScope(requestedScope: string | undefined, actor: ActorContext): CallScope {
    const wantsTeam = String(requestedScope ?? '').trim().toLowerCase() === 'team';
    if (wantsTeam && this.canReadTeam(actor)) return 'team';
    return 'me';
  }

  private buildWhere(
    tenant: TenantContext,
    actor: ActorContext,
    scope: CallScope,
    args: ListLogsArgs,
  ): Prisma.CallLogWhereInput {
    const where: Prisma.CallLogWhereInput = {
      tenantId: tenant.id,
    };

    if (scope === 'me') {
      where.agentUserId = actor.userId;
    } else {
      const requestedAgentId = String(args.agentUserId ?? '').trim();
      if (requestedAgentId) {
        where.agentUserId = requestedAgentId;
      }
    }

    const status = normalizeStatus(args.status);
    if (args.status && !status) {
      throw new BadRequestException('INVALID_CALL_STATUS');
    }
    if (status) where.status = status;

    const from = parseDate(args.from);
    const to = parseDate(args.to);
    if ((args.from && !from) || (args.to && !to)) {
      throw new BadRequestException('INVALID_DATE_RANGE');
    }

    if (from || to) {
      const start = from ?? new Date(0);
      const endRaw = to ?? new Date();
      const end = new Date(endRaw.getTime() + 24 * 60 * 60 * 1000 - 1);
      if (start.getTime() <= end.getTime()) {
        where.startedAt = { gte: start, lte: end };
      } else {
        where.startedAt = { gte: end, lte: start };
      }
    }

    const hasRecording = parseBoolean(args.hasRecording);
    if (hasRecording === true) {
      where.recordingUrl = { not: null };
    } else if (hasRecording === false) {
      where.recordingUrl = null;
    }

    return where;
  }

  private toLogItem(
    row: {
      id: string;
      direction: string;
      fromNumber: string;
      toNumber: string;
      status: string;
      startedAt: Date;
      answeredAt: Date | null;
      endedAt: Date | null;
      durationSec: number | null;
      ext: string;
      recordingUrl: string | null;
      providerCallId: string;
      agentUserId: string;
      agent: {
        firstName: string | null;
        lastName: string | null;
        displayName: string | null;
        email: string | null;
        phone: string | null;
      };
      answeredBy: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        displayName: string | null;
        email: string | null;
        phone: string | null;
      } | null;
    },
    allowRecordingUrl: boolean,
  ) {
    return {
      id: row.id,
      direction: row.direction,
      fromNumber: row.fromNumber,
      toNumber: row.toNumber,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      answeredAt: row.answeredAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      durationSec: row.durationSec,
      ext: row.ext,
      recordingUrl: allowRecordingUrl ? row.recordingUrl : null,
      providerCallId: row.providerCallId,
      agent: {
        userId: row.agentUserId,
        name: userLabel(row.agent),
      },
      answeredBy: row.answeredBy
        ? {
            userId: row.answeredBy.id,
            name: userLabel(row.answeredBy),
          }
        : null,
    };
  }

  async getLive(tenant: TenantContext, actor: ActorContext, requestedScope?: string) {
    const scope = this.resolveScope(requestedScope, actor);
    const now = new Date();

    const memberships = await this.prisma.membership.findMany({
      where: {
        tenantId: tenant.id,
        status: 'ACTIVE',
        role: { in: ['ADMIN', 'SALES_MANAGER', 'SALES_REP'] },
        ...(scope === 'me' ? { userId: actor.userId } : {}),
      },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            id: true,
            ext: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { userId: 'asc' }],
    });

    const userIds = memberships.map((row) => row.userId);
    if (userIds.length === 0) {
      return {
        scope,
        serverNowIso: now.toISOString(),
        agents: [],
      };
    }

    const [activeRows, latestRows] = await Promise.all([
      this.prisma.callLog.findMany({
        where: {
          tenantId: tenant.id,
          agentUserId: { in: userIds },
          endedAt: null,
          status: { in: ACTIVE_CALL_STATUSES },
        },
        select: {
          id: true,
          agentUserId: true,
          direction: true,
          status: true,
          startedAt: true,
        },
        orderBy: [{ startedAt: 'desc' }],
      }),
      this.prisma.callLog.findMany({
        where: {
          tenantId: tenant.id,
          agentUserId: { in: userIds },
        },
        select: {
          id: true,
          agentUserId: true,
          status: true,
          endedAt: true,
          recordingUrl: true,
        },
        orderBy: [{ startedAt: 'desc' }],
        take: Math.max(120, userIds.length * 12),
      }),
    ]);

    const activeByUser = new Map<string, (typeof activeRows)[number]>();
    for (const row of activeRows) {
      if (!activeByUser.has(row.agentUserId)) {
        activeByUser.set(row.agentUserId, row);
      }
    }

    const latestByUser = new Map<string, (typeof latestRows)[number]>();
    for (const row of latestRows) {
      if (!latestByUser.has(row.agentUserId)) {
        latestByUser.set(row.agentUserId, row);
      }
    }

    const agents = memberships.map((membership) => {
      const active = activeByUser.get(membership.userId);
      const latest = latestByUser.get(membership.userId);
      const name = userLabel(membership.user);
      const ext = membership.user.ext?.trim() || '—';
      let state: 'AVAILABLE' | 'RINGING' | 'ON_CALL' | 'AFTER_CALL_WORK' | 'OFFLINE' = 'AVAILABLE';
      let currentCall: { callId: string; direction: string; durationSec: number } | null = null;

      if (!membership.user.ext?.trim()) {
        state = 'OFFLINE';
      } else if (active) {
        state = active.status === 'RINGING' ? 'RINGING' : 'ON_CALL';
        currentCall = {
          callId: active.id,
          direction: active.direction,
          durationSec: Math.max(0, Math.floor((now.getTime() - active.startedAt.getTime()) / 1000)),
        };
      } else if (latest?.endedAt && now.getTime() - latest.endedAt.getTime() <= AFTER_CALL_WORK_WINDOW_MS) {
        state = 'AFTER_CALL_WORK';
      }

      return {
        userId: membership.userId,
        name,
        ext,
        state,
        currentCall,
        hasRecording: Boolean(latest?.recordingUrl),
        lastStatus: latest?.status ?? null,
      };
    });

    return {
      scope,
      serverNowIso: now.toISOString(),
      agents,
    };
  }

  async listLogs(tenant: TenantContext, actor: ActorContext, args: ListLogsArgs) {
    const scope = this.resolveScope(args.scope, actor);
    const where = this.buildWhere(tenant, actor, scope, args);

    const page = clampInt(Number(args.page ?? 1), 1, 5000);
    const pageSize = clampInt(Number(args.pageSize ?? 30), 1, 200);
    const skip = (page - 1) * pageSize;

    const allowRecordingUrl = hasPermission(actor, 'calls.read');

    const [total, rows, answeredCount, missedCount, failedCount, withRecordingCount, durationAgg, inProgressCount] =
      await Promise.all([
        this.prisma.callLog.count({ where }),
        this.prisma.callLog.findMany({
          where,
          select: {
            id: true,
            direction: true,
            fromNumber: true,
            toNumber: true,
            status: true,
            startedAt: true,
            answeredAt: true,
            endedAt: true,
            durationSec: true,
            ext: true,
            recordingUrl: true,
            providerCallId: true,
            agentUserId: true,
            agent: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
            answeredBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          skip,
          take: pageSize,
        }),
        this.prisma.callLog.count({ where: { ...where, answeredAt: { not: null } } }),
        this.prisma.callLog.count({ where: { ...where, status: 'MISSED' } }),
        this.prisma.callLog.count({ where: { ...where, status: 'FAILED' } }),
        this.prisma.callLog.count({ where: { ...where, recordingUrl: { not: null } } }),
        this.prisma.callLog.aggregate({ where, _sum: { durationSec: true } }),
        this.prisma.callLog.count({ where: { ...where, endedAt: null, status: { in: ACTIVE_CALL_STATUSES } } }),
      ]);

    const items = rows.map((row) => this.toLogItem(row, allowRecordingUrl));
    const totalDurationSec = durationAgg._sum.durationSec ?? 0;

    return {
      scope,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      summary: {
        total,
        answered: answeredCount,
        missed: missedCount,
        failed: failedCount,
        inProgress: inProgressCount,
        withRecording: withRecordingCount,
        totalDurationSec,
        avgDurationSec: answeredCount > 0 ? Math.round(totalDurationSec / answeredCount) : 0,
      },
      items,
    };
  }

  async getById(tenant: TenantContext, actor: ActorContext, id: string) {
    const call = await this.prisma.callLog.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        direction: true,
        fromNumber: true,
        toNumber: true,
        status: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        durationSec: true,
        ext: true,
        recordingUrl: true,
        providerCallId: true,
        agentUserId: true,
        agent: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!call) throw new NotFoundException();

    if (call.agentUserId !== actor.userId && !this.canReadTeam(actor)) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const allowRecordingUrl = hasPermission(actor, 'calls.read');
    return this.toLogItem(call, allowRecordingUrl);
  }
}

