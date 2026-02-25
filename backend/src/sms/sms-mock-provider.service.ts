import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmsMockProviderService implements OnModuleDestroy {
  private readonly logger = new Logger(SmsMockProviderService.name);
  private readonly disabled = process.env.SMS_MOCK_DISABLED === 'true';
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  async scheduleLifecycle(smsLogId: string): Promise<void> {
    if (this.disabled) {
      await this.markDeliveredImmediately(smsLogId);
      return;
    }

    const firstDelayMs = this.randomInt(2, 10) * 1000;
    this.schedule(async () => {
      const sentAt = new Date();
      const sent = await this.prisma.smsLog.updateMany({
        where: { id: smsLogId, status: 'QUEUED' },
        data: { status: 'SENT', sentAt },
      });

      if (sent.count === 0) return;

      const secondDelayMs = this.randomInt(5, 30) * 1000;
      this.schedule(async () => {
        const failRate = this.randomInt(3, 8) / 100;
        const shouldFail = Math.random() < failRate;
        const now = new Date();

        await this.prisma.smsLog.updateMany({
          where: { id: smsLogId, status: 'SENT' },
          data: shouldFail
            ? {
                status: 'FAILED',
                failedAt: now,
                errorMessage: 'MOCK_PROVIDER_DELIVERY_FAILURE',
              }
            : {
                status: 'DELIVERED',
                deliveredAt: now,
                errorMessage: null,
              },
        });
      }, secondDelayMs);
    }, firstDelayMs);
  }

  private async markDeliveredImmediately(smsLogId: string) {
    try {
      const now = new Date();
      await this.prisma.smsLog.updateMany({
        where: { id: smsLogId, status: 'QUEUED' },
        data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, errorMessage: null },
      });
    } catch (error) {
      this.logger.warn(`Failed to mark SMS ${smsLogId} as delivered in disabled mode: ${String(error)}`);
    }
  }

  private schedule(fn: () => Promise<void>, delayMs: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void fn().catch((error) => {
        this.logger.warn(`Mock SMS lifecycle step failed: ${String(error)}`);
      });
    }, delayMs);
    this.timers.add(timer);
  }

  private randomInt(min: number, max: number): number {
    const floorMin = Math.ceil(min);
    const floorMax = Math.floor(max);
    return Math.floor(Math.random() * (floorMax - floorMin + 1)) + floorMin;
  }
}
