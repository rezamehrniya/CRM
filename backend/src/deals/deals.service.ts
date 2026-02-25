import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const dealItemSelect = {
  id: true,
  productCode: true,
  productName: true,
  unit: true,
  quantity: true,
  unitPrice: true,
  discountPct: true,
  taxPct: true,
  lineSubtotal: true,
  lineDiscountAmount: true,
  lineTaxAmount: true,
  lineTotal: true,
  position: true,
};

const dealListSelect = {
  id: true,
  title: true,
  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  amount: true,
  stageId: true,
  pipelineId: true,
  contactId: true,
  companyId: true,
  expectedCloseDate: true,
  sentAt: true,
  stage: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  _count: { select: { items: true } },
};

function includesAny(value: string | null | undefined, needles: string[]): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function normalizeStageName(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

function isQuoteStageName(value: string | null | undefined): boolean {
  const normalized = normalizeStageName(value);
  if (!normalized) return false;
  return (
    normalized.includes('ارسال پیش') ||
    normalized.includes('پیش فاکتور') ||
    normalized.includes('پیش‌فاکتور') ||
    normalized.includes('quote') ||
    normalized.includes('proforma') ||
    normalized.includes('sent')
  );
}

function isInvoiceStageName(value: string | null | undefined): boolean {
  const normalized = normalizeStageName(value);
  if (!normalized) return false;
  if (isQuoteStageName(value)) return false;
  return (
    normalized.includes('invoice') ||
    normalized.includes('issued') ||
    normalized.includes('close') ||
    normalized.includes('won') ||
    normalized.includes('بسته') ||
    normalized.includes('فاکتور')
  );
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPositiveInt(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(1, Math.round(fallback));
  return Math.max(1, Math.round(parsed));
}

type DealItemInput = {
  productCode?: string;
  productName?: string;
  unit?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  discountPct?: string | number;
  taxPct?: string | number;
};

type NormalizedDealItem = {
  productCode: string | null;
  productName: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
  lineSubtotal: number;
  lineDiscountAmount: number;
  lineTaxAmount: number;
  lineTotal: number;
  position: number;
};

type DealTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  amount: number;
};

type ProductCatalogItem = {
  code: string;
  name: string;
  unit: string | null;
  basePrice: number;
  isActive: boolean;
};

type InvoiceListQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  dealId?: string;
  q?: string;
};

type InvoiceSourceRef = {
  dealId: string | null;
  dealTitle: string | null;
};

type InvoiceListItem = {
  id: string;
  status: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  totalAmount: number;
  itemsCount: number;
  sourceDealId: string | null;
  sourceDealTitle: string | null;
};

type InvoiceDetailItem = {
  id: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productCode: string | null;
  productName: string | null;
  unit: string | null;
  discountPct: number;
  taxPct: number;
  lineSubtotal: number;
  lineDiscountAmount: number;
  lineTaxAmount: number;
  lineTotal: number;
};

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readMetaString(meta: Prisma.JsonValue | null | undefined, key: string): string | null {
  const record = asRecord(meta);
  if (!record) return null;
  const raw = record[key];
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  return value || null;
}

function readMetaNumber(meta: Prisma.JsonValue | null | undefined, key: string): number {
  const record = asRecord(meta);
  if (!record) return 0;
  return toFiniteNumber(record[key]) ?? 0;
}

function extractInvoiceSource(meta: Prisma.JsonValue | null | undefined): InvoiceSourceRef {
  return {
    dealId: readMetaString(meta, 'dealId'),
    dealTitle: readMetaString(meta, 'dealTitle'),
  };
}

function parseCatalogProduct(meta: unknown): ProductCatalogItem | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const row = meta as Record<string, unknown>;
  const code = String(row.code ?? '').trim().toUpperCase();
  const name = String(row.name ?? '').trim();
  if (!code || !name) return null;

  const parsedPrice = Number(row.basePrice);
  const basePrice = Number.isFinite(parsedPrice) ? Math.max(0, roundMoney(parsedPrice)) : 0;
  const unit = String(row.unit ?? '').trim() || null;
  const isActive = String(row.isActive ?? 'true').trim().toLowerCase() !== 'false';

  return {
    code,
    name,
    unit,
    basePrice,
    isActive,
  };
}

function computeTotals(items: NormalizedDealItem[]): DealTotals {
  return items.reduce<DealTotals>(
    (acc, item) => {
      acc.subtotal += item.lineSubtotal;
      acc.discountAmount += item.lineDiscountAmount;
      acc.taxAmount += item.lineTaxAmount;
      acc.amount += item.lineTotal;
      return acc;
    },
    { subtotal: 0, discountAmount: 0, taxAmount: 0, amount: 0 },
  );
}

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDealDetail(tenantId: string, id: string) {
    return this.prisma.deal.findFirst({
      where: { id, tenantId },
      select: {
        ...dealListSelect,
        tenantId: true,
        items: {
          select: dealItemSelect,
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  private summarizeInvoiceRow(row: {
    id: string;
    status: string;
    issuedAt: Date | null;
    dueAt: Date | null;
    paidAt: Date | null;
    totalAmount: number | null;
    items: Array<{ totalPrice: number; metaJson: Prisma.JsonValue | null }>;
  }): InvoiceListItem {
    const sourceMeta = row.items.map((item) => extractInvoiceSource(item.metaJson)).find((item) => item.dealId) ?? {
      dealId: null,
      dealTitle: null,
    };
    const computedTotal =
      toFiniteNumber(row.totalAmount) ??
      row.items.reduce((sum, item) => sum + (toFiniteNumber(item.totalPrice) ?? 0), 0);

    return {
      id: row.id,
      status: row.status,
      issuedAt: row.issuedAt,
      dueAt: row.dueAt,
      paidAt: row.paidAt,
      totalAmount: Math.max(0, roundMoney(computedTotal)),
      itemsCount: row.items.length,
      sourceDealId: sourceMeta.dealId,
      sourceDealTitle: sourceMeta.dealTitle,
    };
  }

  private matchesInvoiceQuery(item: InvoiceListItem, queryText: string): boolean {
    if (!queryText) return true;
    const haystack = `${item.id} ${item.status} ${item.sourceDealTitle ?? ''} ${item.sourceDealId ?? ''}`.toLowerCase();
    return haystack.includes(queryText);
  }

  async listInvoices(tenant: TenantContext, query?: InvoiceListQuery) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const normalizedStatus = String(query?.status ?? '')
      .trim()
      .toUpperCase();
    const normalizedDealId = String(query?.dealId ?? '').trim();
    const normalizedQ = String(query?.q ?? '')
      .trim()
      .toLowerCase();

    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        totalAmount: true,
        items: {
          select: {
            totalPrice: true,
            metaJson: true,
          },
        },
      },
    });

    let items = rows.map((row) => this.summarizeInvoiceRow(row));
    if (normalizedDealId) {
      items = items.filter((item) => item.sourceDealId === normalizedDealId);
    }
    if (normalizedQ) {
      items = items.filter((item) => this.matchesInvoiceQuery(item, normalizedQ));
    }

    const total = items.length;
    const skip = (page - 1) * pageSize;
    const data = items.slice(skip, skip + pageSize);
    return { data, total, page, pageSize };
  }

  async getInvoice(tenant: TenantContext, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        totalAmount: true,
        items: {
          orderBy: [{ id: 'asc' }],
          select: {
            id: true,
            type: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            metaJson: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException();

    const sourceMeta = invoice.items
      .map((item) => extractInvoiceSource(item.metaJson))
      .find((item) => item.dealId) ?? { dealId: null, dealTitle: null };

    const items: InvoiceDetailItem[] = invoice.items.map((item) => ({
      id: item.id,
      type: item.type,
      quantity: toFiniteNumber(item.quantity) ?? 0,
      unitPrice: roundMoney(toFiniteNumber(item.unitPrice) ?? 0),
      totalPrice: roundMoney(toFiniteNumber(item.totalPrice) ?? 0),
      productCode: readMetaString(item.metaJson, 'productCode'),
      productName: readMetaString(item.metaJson, 'productName'),
      unit: readMetaString(item.metaJson, 'unit'),
      discountPct: readMetaNumber(item.metaJson, 'discountPct'),
      taxPct: readMetaNumber(item.metaJson, 'taxPct'),
      lineSubtotal: roundMoney(readMetaNumber(item.metaJson, 'lineSubtotal')),
      lineDiscountAmount: roundMoney(readMetaNumber(item.metaJson, 'lineDiscountAmount')),
      lineTaxAmount: roundMoney(readMetaNumber(item.metaJson, 'lineTaxAmount')),
      lineTotal: roundMoney(
        readMetaNumber(item.metaJson, 'lineTotal') || (toFiniteNumber(item.totalPrice) ?? 0),
      ),
    }));

    const computedTotal =
      toFiniteNumber(invoice.totalAmount) ??
      items.reduce((sum, item) => sum + (toFiniteNumber(item.totalPrice) ?? 0), 0);

    return {
      id: invoice.id,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      totalAmount: Math.max(0, roundMoney(computedTotal)),
      sourceDealId: sourceMeta.dealId,
      sourceDealTitle: sourceMeta.dealTitle,
      items,
    };
  }

  private async getProductCatalogByCode(tenantId: string): Promise<Map<string, ProductCatalogItem>> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: 'PRODUCT',
        action: 'UPSERT',
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        metaJson: true,
      },
    });

    const catalog = new Map<string, ProductCatalogItem>();
    for (const row of rows) {
      const parsed = parseCatalogProduct(row.metaJson);
      if (!parsed) continue;
      if (catalog.has(parsed.code)) continue;
      catalog.set(parsed.code, parsed);
    }
    return catalog;
  }

  private async normalizeDealItems(
    tenantId: string,
    items: DealItemInput[] | undefined,
  ): Promise<NormalizedDealItem[] | null> {
    if (items === undefined) return null;
    if (!Array.isArray(items)) throw new BadRequestException('items must be an array');

    const catalog = await this.getProductCatalogByCode(tenantId);

    return items
      .map((raw, index) => {
        const inputCode = String(raw?.productCode ?? '').trim().toUpperCase();
        const catalogItem = inputCode ? catalog.get(inputCode) ?? null : null;

        if (inputCode && !catalogItem) {
          throw new BadRequestException(`item[${index}] productCode not found`);
        }
        if (catalogItem && !catalogItem.isActive) {
          throw new BadRequestException(`item[${index}] productCode is inactive`);
        }

        const fallbackName = catalogItem?.name ?? '';
        const productName = String(raw?.productName ?? '').trim() || fallbackName;
        if (!productName) {
          throw new BadRequestException(`item[${index}] productName is required`);
        }

        const quantityRaw = toFiniteNumber(raw?.quantity);
        const unitPriceFromInput = toFiniteNumber(raw?.unitPrice);
        const unitPriceFallback = catalogItem?.basePrice ?? null;
        const unitPriceRaw = unitPriceFromInput ?? unitPriceFallback;
        const discountPctRaw = toFiniteNumber(raw?.discountPct) ?? 0;
        const taxPctRaw = toFiniteNumber(raw?.taxPct) ?? 0;

        if (quantityRaw === null || quantityRaw <= 0) {
          throw new BadRequestException(`item[${index}] quantity must be greater than 0`);
        }
        if (unitPriceRaw === null || unitPriceRaw < 0) {
          throw new BadRequestException(`item[${index}] unitPrice must be a valid non-negative number`);
        }

        const quantity = Number(quantityRaw.toFixed(3));
        const unitPrice = roundMoney(unitPriceRaw);
        const discountPct = Number(clamp(discountPctRaw, 0, 100).toFixed(2));
        const taxPct = Number(clamp(taxPctRaw, 0, 100).toFixed(2));
        const unit = String(raw?.unit ?? '').trim() || catalogItem?.unit || null;

        const lineSubtotal = roundMoney(quantity * unitPrice);
        const lineDiscountAmount = roundMoney((lineSubtotal * discountPct) / 100);
        const taxableBase = Math.max(0, lineSubtotal - lineDiscountAmount);
        const lineTaxAmount = roundMoney((taxableBase * taxPct) / 100);
        const lineTotal = taxableBase + lineTaxAmount;

        return {
          productCode: inputCode || catalogItem?.code || null,
          productName,
          unit,
          quantity,
          unitPrice,
          discountPct,
          taxPct,
          lineSubtotal,
          lineDiscountAmount,
          lineTaxAmount,
          lineTotal,
          position: index,
        };
      })
      .filter((item) => item.quantity > 0);
  }

  private resolveTotals(items: NormalizedDealItem[] | null, amount: unknown): DealTotals {
    if (items !== null) {
      if (items.length === 0) return { subtotal: 0, discountAmount: 0, taxAmount: 0, amount: 0 };
      return computeTotals(items);
    }

    const fallbackAmount = toFiniteNumber(amount);
    if (fallbackAmount === null) return { subtotal: 0, discountAmount: 0, taxAmount: 0, amount: 0 };

    const rounded = roundMoney(Math.max(0, fallbackAmount));
    return { subtotal: rounded, discountAmount: 0, taxAmount: 0, amount: rounded };
  }

  async list(tenant: TenantContext, query?: { q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId: tenant.id };
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        {
          contact: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        select: dealListSelect,
        orderBy: { id: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    const deal = await this.getDealDetail(tenant.id, id);
    if (!deal) throw new NotFoundException();
    return deal;
  }

  async create(
    tenant: TenantContext,
    body: {
      title: string;
      amount?: string | number;
      items?: DealItemInput[];
      stageId: string;
      pipelineId: string;
      contactId?: string;
      companyId?: string;
      expectedCloseDate?: string;
    },
  ) {
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('title is required');

    const normalizedItems = await this.normalizeDealItems(tenant.id, body.items);
    const totals = this.resolveTotals(normalizedItems, body.amount);

    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: body.stageId, tenantId: tenant.id },
      select: { name: true },
    });
    const sentAt = stage && includesAny(stage.name, ['ارسال', 'پیش', 'quote', 'proforma', 'sent']) ? new Date() : null;

    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId: tenant.id,
          title,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          amount: totals.amount,
          stageId: body.stageId,
          pipelineId: body.pipelineId,
          contactId: body.contactId || null,
          companyId: body.companyId || null,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          sentAt,
        },
        select: { id: true },
      });

      if (normalizedItems && normalizedItems.length > 0) {
        await tx.dealItem.createMany({
          data: normalizedItems.map((item) => ({
            tenantId: tenant.id,
            dealId: deal.id,
            ...item,
          })),
        });
      }

      const withItems = await tx.deal.findFirst({
        where: { id: deal.id, tenantId: tenant.id },
        select: {
          ...dealListSelect,
          tenantId: true,
          items: {
            select: dealItemSelect,
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });

      if (!withItems) throw new NotFoundException();
      return withItems;
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    body: Partial<{
      title: string;
      amount: string | number;
      items: DealItemInput[];
      stageId: string;
      pipelineId: string;
      contactId: string;
      companyId: string;
      expectedCloseDate: string;
    }>,
  ) {
    const existing = await this.prisma.deal.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, sentAt: true, amount: true },
    });
    if (!existing) throw new NotFoundException();

    const normalizedItems = await this.normalizeDealItems(tenant.id, body.items);
    const totals = this.resolveTotals(
      normalizedItems,
      body.amount !== undefined ? body.amount : existing.amount,
    );

    const data: any = {};
    if (body.title !== undefined) data.title = body.title.trim();

    if (body.amount !== undefined || normalizedItems !== null) {
      data.subtotal = totals.subtotal;
      data.discountAmount = totals.discountAmount;
      data.taxAmount = totals.taxAmount;
      data.amount = totals.amount;
    }

    if (body.stageId !== undefined) {
      data.stageId = body.stageId;
      const stage = await this.prisma.pipelineStage.findFirst({
        where: { id: body.stageId, tenantId: tenant.id },
        select: { name: true },
      });
      const isSentStage = !!stage && includesAny(stage.name, ['ارسال', 'پیش', 'quote', 'proforma', 'sent']);
      data.sentAt = isSentStage ? existing.sentAt ?? new Date() : null;
    }
    if (body.pipelineId !== undefined) data.pipelineId = body.pipelineId;
    if (body.contactId !== undefined) data.contactId = body.contactId || null;
    if (body.companyId !== undefined) data.companyId = body.companyId || null;
    if (body.expectedCloseDate !== undefined) {
      data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id },
        data,
        select: { id: true },
      });

      if (normalizedItems !== null) {
        await tx.dealItem.deleteMany({
          where: { tenantId: tenant.id, dealId: id },
        });
        if (normalizedItems.length > 0) {
          await tx.dealItem.createMany({
            data: normalizedItems.map((item) => ({
              tenantId: tenant.id,
              dealId: id,
              ...item,
            })),
          });
        }
      }

      const updated = await tx.deal.findFirst({
        where: { id, tenantId: tenant.id },
        select: {
          ...dealListSelect,
          tenantId: true,
          items: {
            select: dealItemSelect,
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });

      if (!updated) throw new NotFoundException();
      return updated;
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.prisma.deal.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.deal.delete({ where: { id } });
    return { ok: true };
  }

  private async findOperationalStage(
    tenant: TenantContext,
    mode: 'SEND_QUOTE' | 'INVOICE',
    pipelineId?: string | null,
  ) {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id, ...(pipelineId ? { pipelineId } : {}) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    if (mode === 'SEND_QUOTE') {
      return stages.find((stage) => isQuoteStageName(stage.name)) ?? null;
    }

    return stages.find((stage) => isInvoiceStageName(stage.name)) ?? null;
  }

  async send(tenant: TenantContext, id: string) {
    const existing = await this.prisma.deal.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, pipelineId: true },
    });
    if (!existing) throw new NotFoundException();

    const stage =
      (await this.findOperationalStage(tenant, 'SEND_QUOTE', existing.pipelineId)) ??
      (await this.findOperationalStage(tenant, 'SEND_QUOTE'));

    if (!stage) {
      return this.getOne(tenant, id);
    }

    await this.prisma.deal.update({
      where: { id },
      data: { stageId: stage.id, pipelineId: stage.pipelineId, sentAt: new Date() },
    });

    return this.getOne(tenant, id);
  }

  async convertToInvoice(tenant: TenantContext, id: string) {
    const existing = await this.prisma.deal.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        title: true,
        pipelineId: true,
        stage: { select: { name: true } },
        amount: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        items: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            unit: true,
            quantity: true,
            unitPrice: true,
            discountPct: true,
            taxPct: true,
            lineSubtotal: true,
            lineDiscountAmount: true,
            lineTaxAmount: true,
            lineTotal: true,
            position: true,
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!existing) throw new NotFoundException();

    const alreadyInInvoiceStage = isInvoiceStageName(existing.stage?.name);
    const stage =
      (await this.findOperationalStage(tenant, 'INVOICE', existing.pipelineId)) ??
      (await this.findOperationalStage(tenant, 'INVOICE'));

    await this.prisma.$transaction(async (tx) => {
      if (stage && !alreadyInInvoiceStage) {
        await tx.deal.update({
          where: { id },
          data: {
            stageId: stage.id,
            pipelineId: stage.pipelineId,
            sentAt: null,
            expectedCloseDate: new Date(),
          },
        });
      }

      const existingInvoiceLink = await tx.invoiceItem.findFirst({
        where: {
          invoice: { tenantId: tenant.id },
          metaJson: {
            path: ['dealId'],
            equals: existing.id,
          },
        },
        select: { invoiceId: true },
      });
      if (existingInvoiceLink) {
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'CONVERT_TO_INVOICE_DUPLICATE',
            entityType: 'DEAL',
            entityId: existing.id,
            metaJson: {
              invoiceId: existingInvoiceLink.invoiceId,
            },
          },
        });
        return;
      }

      const now = new Date();
      const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const lineItems = existing.items ?? [];
      const totalAmount = Math.max(
        0,
        roundMoney(
          toFiniteNumber(existing.amount) ??
            lineItems.reduce((sum, item) => sum + (toFiniteNumber(item.lineTotal) ?? 0), 0),
        ),
      );

      const invoice = await tx.invoice.create({
        data: {
          tenantId: tenant.id,
          status: 'ISSUED',
          issuedAt: now,
          dueAt,
          totalAmount,
        },
        select: { id: true },
      });

      if (lineItems.length > 0) {
        await tx.invoiceItem.createMany({
          data: lineItems.map((item, index) => ({
            invoiceId: invoice.id,
            type: 'PRODUCT',
            quantity: toPositiveInt(item.quantity, 1),
            unitPrice: roundMoney(toFiniteNumber(item.unitPrice) ?? 0),
            totalPrice: roundMoney(toFiniteNumber(item.lineTotal) ?? 0),
            metaJson: {
              dealId: existing.id,
              dealTitle: existing.title,
              dealItemId: item.id,
              position: index,
              productCode: item.productCode,
              productName: item.productName,
              unit: item.unit,
              quantity: toFiniteNumber(item.quantity),
              discountPct: toFiniteNumber(item.discountPct) ?? 0,
              taxPct: toFiniteNumber(item.taxPct) ?? 0,
              lineSubtotal: roundMoney(toFiniteNumber(item.lineSubtotal) ?? 0),
              lineDiscountAmount: roundMoney(toFiniteNumber(item.lineDiscountAmount) ?? 0),
              lineTaxAmount: roundMoney(toFiniteNumber(item.lineTaxAmount) ?? 0),
              lineTotal: roundMoney(toFiniteNumber(item.lineTotal) ?? 0),
              source: 'QUOTE_CONVERT',
            } as any,
          })),
        });
      } else {
        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            type: 'QUOTE_TOTAL',
            quantity: 1,
            unitPrice: totalAmount,
            totalPrice: totalAmount,
            metaJson: {
              dealId: existing.id,
              dealTitle: existing.title,
              subtotal: roundMoney(toFiniteNumber(existing.subtotal) ?? totalAmount),
              discountAmount: roundMoney(toFiniteNumber(existing.discountAmount) ?? 0),
              taxAmount: roundMoney(toFiniteNumber(existing.taxAmount) ?? 0),
              source: 'QUOTE_CONVERT',
            } as any,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: 'CONVERT_TO_INVOICE',
          entityType: 'DEAL',
          entityId: existing.id,
          metaJson: {
            invoiceId: invoice.id,
            itemCount: lineItems.length,
            totalAmount,
          },
        },
      });
    });

    return this.getOne(tenant, id);
  }
}
