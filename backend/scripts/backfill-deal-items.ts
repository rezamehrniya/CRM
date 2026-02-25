import { PrismaClient } from '@prisma/client';

type ProductSeed = {
  code: string;
  name: string;
  unit: string;
  basePrice: number;
};

type ProductCatalogItem = ProductSeed & {
  isActive: boolean;
};

const prisma = new PrismaClient();

const FALLBACK_PRODUCTS: ProductSeed[] = [
  { code: 'CRM-CORE', name: 'لایسنس CRM پایه', unit: 'لایسنس', basePrice: 12_000_000 },
  { code: 'CRM-PRO', name: 'لایسنس CRM حرفه‌ای', unit: 'لایسنس', basePrice: 18_000_000 },
  { code: 'ONBOARD', name: 'راه‌اندازی و استقرار', unit: 'پروژه', basePrice: 25_000_000 },
  { code: 'TRAINING', name: 'آموزش تیم فروش', unit: 'ساعت', basePrice: 1_800_000 },
  { code: 'SUPPORT', name: 'پشتیبانی ویژه', unit: 'ماه', basePrice: 3_200_000 },
];

function toMoney(value: number): number {
  return Math.round(value);
}

function parseCatalogProduct(meta: unknown): ProductCatalogItem | null {
  if (!meta || typeof meta !== 'object') return null;
  const row = meta as Record<string, unknown>;
  const code = String(row.code ?? '').trim().toUpperCase();
  const name = String(row.name ?? '').trim();
  const unit = String(row.unit ?? '').trim() || 'عدد';
  const basePrice = Number(row.basePrice ?? row.price ?? row.unitPrice);
  const isActive = row.isActive !== false;
  if (!code || !name || !Number.isFinite(basePrice) || basePrice < 0) return null;
  return {
    code,
    name,
    unit,
    basePrice: toMoney(basePrice),
    isActive,
  };
}

function buildLine(
  tenantId: string,
  dealId: string,
  position: number,
  product: ProductCatalogItem,
  quantity: number,
  discountPct: number,
  taxPct: number,
) {
  const qty = Math.max(0.001, Number(quantity.toFixed(3)));
  const unitPrice = toMoney(product.basePrice);
  const lineSubtotal = toMoney(qty * unitPrice);
  const lineDiscountAmount = toMoney((lineSubtotal * discountPct) / 100);
  const taxableBase = Math.max(0, lineSubtotal - lineDiscountAmount);
  const lineTaxAmount = toMoney((taxableBase * taxPct) / 100);
  const lineTotal = toMoney(taxableBase + lineTaxAmount);

  return {
    tenantId,
    dealId,
    productCode: product.code,
    productName: product.name,
    unit: product.unit,
    quantity: qty,
    unitPrice,
    discountPct: Number(discountPct.toFixed(2)),
    taxPct: Number(taxPct.toFixed(2)),
    lineSubtotal,
    lineDiscountAmount,
    lineTaxAmount,
    lineTotal,
    position,
  };
}

async function loadCatalog(tenantId: string): Promise<ProductCatalogItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entityType: 'PRODUCT',
      action: { in: ['UPSERT', 'CREATE', 'UPDATE'] },
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      entityId: true,
      metaJson: true,
    },
  });

  const map = new Map<string, ProductCatalogItem>();
  for (const log of logs) {
    const parsed = parseCatalogProduct(log.metaJson);
    if (!parsed) continue;
    if (!map.has(parsed.code)) {
      map.set(parsed.code, parsed);
    }
  }

  const rows = Array.from(map.values()).filter((row) => row.isActive);
  if (rows.length > 0) return rows;

  return FALLBACK_PRODUCTS.map((row) => ({ ...row, isActive: true }));
}

async function main() {
  const tenantSlug = process.argv[2] || 'demo';
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  const catalog = await loadCatalog(tenant.id);
  if (catalog.length === 0) {
    throw new Error('No active products found in catalog');
  }

  const deals = await prisma.deal.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
    orderBy: [{ id: 'asc' }],
  });

  let updatedDeals = 0;
  let insertedLines = 0;

  for (let i = 0; i < deals.length; i += 1) {
    const deal = deals[i];
    const existingCount = await prisma.dealItem.count({
      where: { tenantId: tenant.id, dealId: deal.id },
    });
    if (existingCount > 0) continue;

    const p1 = catalog[i % catalog.length];
    const p2 = catalog[(i + 1) % catalog.length];
    const p3 = catalog[(i + 2) % catalog.length];

    const lines = [
      buildLine(tenant.id, deal.id, 0, p1, 1 + (i % 3), i % 2 === 0 ? 5 : 0, 10),
      buildLine(tenant.id, deal.id, 1, p2, 1 + ((i + 1) % 2), 0, 10),
      buildLine(tenant.id, deal.id, 2, p3, 2 + (i % 4), 3, 10),
    ];

    await prisma.dealItem.createMany({ data: lines });

    const summary = lines.reduce(
      (acc, line) => {
        acc.subtotal += line.lineSubtotal;
        acc.discountAmount += line.lineDiscountAmount;
        acc.taxAmount += line.lineTaxAmount;
        acc.amount += line.lineTotal;
        return acc;
      },
      { subtotal: 0, discountAmount: 0, taxAmount: 0, amount: 0 },
    );

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        subtotal: summary.subtotal,
        discountAmount: summary.discountAmount,
        taxAmount: summary.taxAmount,
        amount: summary.amount,
      },
    });

    updatedDeals += 1;
    insertedLines += lines.length;
  }

  console.log(
    `Backfill done for tenant=${tenant.slug}: dealsUpdated=${updatedDeals}, linesInserted=${insertedLines}`,
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

