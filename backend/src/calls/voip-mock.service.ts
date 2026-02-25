import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AgentRow = {
  tenantId: string;
  userId: string;
  user: {
    ext: string | null;
  };
};

const ACTIVE_CALL_STATUSES = ['RINGING', 'IN_PROGRESS', 'ANSWERED'] as const;

@Injectable()
export class VoipMockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoipMockService.name);
  private readonly pollMs = 45_000;
  private readonly disabled = process.env.VOIP_MOCK_DISABLED === 'true';

  private intervalRef: NodeJS.Timeout | null = null;
  private pendingTimeouts = new Set<NodeJS.Timeout>();
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (this.disabled) {
      this.logger.log('Mock VOIP engine is disabled (VOIP_MOCK_DISABLED=true).');
      return;
    }

    this.intervalRef = setInterval(() => {
      void this.generateTraffic();
    }, this.pollMs);

    this.schedule(
      () => {
        void this.generateTraffic();
      },
      8_000,
    );

    this.logger.log('Mock VOIP engine started.');
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    for (const timer of this.pendingTimeouts) {
      clearTimeout(timer);
    }
    this.pendingTimeouts.clear();
  }

  private schedule(fn: () => void, delayMs: number) {
    const timer = setTimeout(() => {
      this.pendingTimeouts.delete(timer);
      fn();
    }, delayMs);
    this.pendingTimeouts.add(timer);
  }

  private randomInt(min: number, max: number) {
    const floorMin = Math.ceil(min);
    const floorMax = Math.floor(max);
    return Math.floor(Math.random() * (floorMax - floorMin + 1)) + floorMin;
  }

  private randomExternalNumber(): string {
    return `09${this.randomInt(100000000, 999999999)}`;
  }

  private async generateTraffic() {
    if (this.running) return;
    this.running = true;

    try {
      const members: AgentRow[] = await this.prisma.membership.findMany({
        where: {
          status: 'ACTIVE',
          role: { in: ['SALES_MANAGER', 'SALES_REP'] },
          tenant: { status: 'ACTIVE' },
        },
        select: {
          tenantId: true,
          userId: true,
          user: {
            select: {
              ext: true,
            },
          },
        },
      });

      const byTenant = new Map<string, AgentRow[]>();
      for (const member of members) {
        const ext = member.user.ext?.trim();
        if (!ext) continue;
        const bucket = byTenant.get(member.tenantId) ?? [];
        bucket.push(member);
        byTenant.set(member.tenantId, bucket);
      }

      for (const [tenantId, agents] of byTenant.entries()) {
        if (agents.length === 0) continue;
        if (Math.random() < 0.35) continue;

        const callsToGenerate = Math.random() < 0.2 ? 2 : 1;
        for (let i = 0; i < callsToGenerate; i += 1) {
          const agent = agents[this.randomInt(0, agents.length - 1)];
          await this.createSimulatedCall(tenantId, agent);
        }
      }
    } catch (error) {
      this.logger.error('Mock VOIP traffic generation failed', error as Error);
    } finally {
      this.running = false;
    }
  }

  private async createSimulatedCall(tenantId: string, agent: AgentRow) {
    const ext = agent.user.ext?.trim();
    if (!ext) return;

    const activeCall = await this.prisma.callLog.findFirst({
      where: {
        tenantId,
        agentUserId: agent.userId,
        endedAt: null,
        status: { in: [...ACTIVE_CALL_STATUSES] },
      },
      select: { id: true },
    });
    if (activeCall) return;

    const now = new Date();
    const direction = Math.random() < 0.5 ? 'INBOUND' : 'OUTBOUND';
    const externalNumber = this.randomExternalNumber();

    const createdCall = await this.prisma.callLog.create({
      data: {
        tenantId,
        direction,
        fromNumber: direction === 'INBOUND' ? externalNumber : ext,
        toNumber: direction === 'INBOUND' ? ext : externalNumber,
        agentUserId: agent.userId,
        status: 'RINGING',
        startedAt: now,
        ext,
        providerCallId: `mock-${tenantId}-${agent.userId}-${now.getTime()}-${this.randomInt(1000, 9999)}`,
      },
      select: {
        id: true,
      },
    });

    const ringSec = this.randomInt(4, 10);
    const ringMs = ringSec * 1000;
    const outcome = Math.random();

    if (outcome < 0.2) {
      this.schedule(() => {
        void this.finishMissedOrFailed(createdCall.id, 'MISSED', ringSec);
      }, ringMs);
      return;
    }

    if (outcome < 0.3) {
      this.schedule(() => {
        void this.finishMissedOrFailed(createdCall.id, 'FAILED', ringSec);
      }, ringMs);
      return;
    }

    const talkSec = this.randomInt(25, 220);

    this.schedule(() => {
      void this.answerCall(createdCall.id, agent.userId, talkSec);
    }, ringMs);
  }

  private async finishMissedOrFailed(callId: string, status: 'MISSED' | 'FAILED', ringSec: number) {
    const endedAt = new Date();
    await this.prisma.callLog.updateMany({
      where: {
        id: callId,
        endedAt: null,
        status: 'RINGING',
      },
      data: {
        status,
        endedAt,
        durationSec: status === 'FAILED' ? null : 0,
      },
    });

    if (status === 'MISSED' && ringSec > 0) {
      await this.prisma.callLog.updateMany({
        where: {
          id: callId,
          answeredAt: null,
        },
        data: {
          durationSec: 0,
        },
      });
    }
  }

  private async answerCall(callId: string, agentUserId: string, talkSec: number) {
    const answeredAt = new Date();
    const answerUpdate = await this.prisma.callLog.updateMany({
      where: {
        id: callId,
        endedAt: null,
        status: 'RINGING',
      },
      data: {
        status: 'ANSWERED',
        answeredAt,
        answeredByUserId: agentUserId,
      },
    });

    if (answerUpdate.count === 0) return;

    this.schedule(() => {
      void this.prisma.callLog.updateMany({
        where: {
          id: callId,
          endedAt: null,
          status: 'ANSWERED',
        },
        data: {
          status: 'IN_PROGRESS',
        },
      });
    }, 1_000);

    this.schedule(() => {
      const endedAt = new Date();
      void this.prisma.callLog.updateMany({
        where: {
          id: callId,
          endedAt: null,
          status: { in: ['ANSWERED', 'IN_PROGRESS'] },
        },
        data: {
          status: 'ENDED',
          endedAt,
          durationSec: talkSec,
          recordingUrl: `https://mock-voip.local/recordings/${callId}.mp3`,
        },
      });
    }, talkSec * 1000);
  }
}

