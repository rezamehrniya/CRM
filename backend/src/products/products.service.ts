import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

type ProductImportItem = {
  code?: string;
  name?: string;
  unit?: string;
  basePrice?: string | number;
  category?: string;
  isActive?: string | boolean | number;
};

type ProductRecord = {
  code: string;
  name: string;
  unit: string;
  basePrice: number;
  category: string | null;
  isActive: boolean;
  updatedAt: string;
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'y', 'active'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'inactive', 'disabled'].includes(normalized)) return false;
  return fallback;
}

function parseBasePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const text = toText(value).replaceAll(',', '');
  if (!text) return 0;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeCode(raw: string): string {
  const base = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_]/g, '');
  return base;
}

function generatedCode(name: string, row: number): string {
  const seed = normalizeCode(name).replace(/[^A-Z0-9]/g, '');
  const shortSeed = seed.slice(0, 8) || 'ITEM';
  return `PRD-${shortSeed}-${row}`;
}

function parseProduct(meta: Prisma.JsonValue | null): ProductRecord | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const code = toText(record.code);
  const name = toText(record.name);
  if (!code || !name) return null;

  return {
    code,
    name,
    unit: toText(record.unit) || 'عدد',
    basePrice: Number(record.basePrice) || 0,
    category: toText(record.category) || null,
    isActive: toBool(record.isActive, true),
    updatedAt: toText(record.updatedAt) || new Date().toISOString(),
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenant: TenantContext,
    query?: {
      q?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query?.pageSize ?? 25));
    const q = toText(query?.q).toLowerCase();

    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId: tenant.id,
        entityType: 'PRODUCT',
        action: 'UPSERT',
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        entityId: true,
        metaJson: true,
        createdAt: true,
      },
    });

    const products = rows
      .map((row) => parseProduct(row.metaJson))
      .filter((item): item is ProductRecord => !!item)
      .filter((item) => {
        if (!q) return true;
        return (
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.category ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const total = products.length;
    const skip = (page - 1) * pageSize;
    const data = products.slice(skip, skip + pageSize);
    return { data, total, page, pageSize };
  }

  async importMany(
    tenant: TenantContext,
    actorUserId: string | undefined,
    items: ProductImportItem[],
  ) {
    const source = Array.isArray(items) ? items.slice(0, 1000) : [];
    if (source.length === 0) {
      throw new BadRequestException('EMPTY_ITEMS');
    }

    const existingRows = await this.prisma.auditLog.findMany({
      where: {
        tenantId: tenant.id,
        entityType: 'PRODUCT',
        action: 'UPSERT',
      },
      select: {
        entityId: true,
        metaJson: true,
      },
    });

    const existingCodes = new Set(
      existingRows
        .map((row) => parseProduct(row.metaJson))
        .filter((item): item is ProductRecord => !!item)
        .map((item) => item.code),
    );

    const seenCodes = new Set<string>();
    const rejected: Array<{ row: number; reason: string }> = [];
    const normalized: ProductRecord[] = [];

    source.forEach((item, index) => {
      const row = index + 2;
      const name = toText(item.name);
      if (!name) {
        rejected.push({ row, reason: 'name is required' });
        return;
      }

      const parsedPrice = parseBasePrice(item.basePrice);
      if (parsedPrice === null) {
        rejected.push({ row, reason: 'basePrice must be a valid non-negative number' });
        return;
      }

      const rawCode = toText(item.code);
      const resolvedCode = normalizeCode(rawCode || generatedCode(name, row));
      if (!resolvedCode) {
        rejected.push({ row, reason: 'invalid code' });
        return;
      }

      if (seenCodes.has(resolvedCode)) {
        rejected.push({ row, reason: `duplicate code in file (${resolvedCode})` });
        return;
      }
      seenCodes.add(resolvedCode);

      normalized.push({
        code: resolvedCode,
        name,
        unit: toText(item.unit) || 'عدد',
        basePrice: parsedPrice,
        category: toText(item.category) || null,
        isActive: toBool(item.isActive, true),
        updatedAt: new Date().toISOString(),
      });
    });

    if (normalized.length === 0) {
      return {
        created: 0,
        updated: 0,
        rejected,
      };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let created = 0;
    let updated = 0;

    for (const product of normalized) {
      if (existingCodes.has(product.code)) updated += 1;
      else created += 1;

      ops.push(
        this.prisma.auditLog.deleteMany({
          where: {
            tenantId: tenant.id,
            entityType: 'PRODUCT',
            entityId: product.code,
          },
        }),
      );

      ops.push(
        this.prisma.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId: actorUserId ?? null,
            action: 'UPSERT',
            entityType: 'PRODUCT',
            entityId: product.code,
            metaJson: product as Prisma.InputJsonValue,
          },
        }),
      );
    }

    await this.prisma.$transaction(ops);

    return { created, updated, rejected };
  }
}

