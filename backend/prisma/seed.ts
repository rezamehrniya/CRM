/**
 * Seed demo tenant + demo users (sales manager and sales rep).
 * Run: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

type EnsureTenantRbacFn = (prisma: PrismaClient, tenantId: string) => Promise<unknown>;

function resolveEnsureTenantRbac(): EnsureTenantRbacFn {
  const candidates = ['../src/auth/rbac.utils', '../dist/auth/rbac.utils'];
  for (const modulePath of candidates) {
    try {
      const mod = require(modulePath);
      if (typeof mod?.ensureTenantRbac === 'function') {
        return mod.ensureTenantRbac as EnsureTenantRbacFn;
      }
    } catch {
      // Ignore and try the next candidate.
    }
  }
  return async () => undefined;
}

const ensureTenantRbac = resolveEnsureTenantRbac();

const isProd = process.env.NODE_ENV === 'production';
const allowDemoSeed = ['true', '1', 'yes', 'on'].includes(
  String(process.env.ALLOW_DEMO_SEED ?? '').trim().toLowerCase(),
);

if (isProd && !allowDemoSeed) {
  console.error(
    '[seed] Refusing to run demo seed in production. Set ALLOW_DEMO_SEED=true to override (not recommended).'
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const DEMO_TENANT_SLUG = process.env.DEMO_TENANT_SLUG?.trim() || 'demo';
const DEMO_MANAGER_EMAIL = process.env.DEMO_OWNER_EMAIL?.trim().toLowerCase() || 'owner@demo.com';
const DEMO_MANAGER_LEGACY_EMAIL = process.env.DEMO_OWNER_LEGACY_EMAIL?.trim().toLowerCase() || 'owner@ddemo';
const DEMO_SELLER_EMAIL = process.env.DEMO_SELLER_EMAIL?.trim().toLowerCase() || 'seller@demo.com';
const DEMO_USER_PASSWORD = process.env.DEMO_DEFAULT_PASSWORD?.trim() || '12345678';

type DemoRoleKey = 'SALES_MANAGER' | 'SALES_REP';

type DemoAccountOptions = {
  tenantId: string;
  email: string;
  legacyEmails?: string[];
  passwordHash: string;
  roleKey: DemoRoleKey;
  roleId: string;
  ext: string;
};

type StageKey = 'COLD' | 'WARM' | 'QUALIFIED' | 'QUOTE_SENT' | 'NEGOTIATION' | 'SIGNED_CONTRACT';

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function detectStageKey(name: string | null | undefined): StageKey {
  const normalized = normalizeText(name);
  if (
    normalized.includes('signed') ||
    normalized.includes('امضا') ||
    normalized.includes('قرارداد') ||
    normalized.includes('بسته') ||
    normalized.includes('won')
  ) {
    return 'SIGNED_CONTRACT';
  }
  if (normalized.includes('negotiation') || normalized.includes('مذاکره')) return 'NEGOTIATION';
  if (
    normalized.includes('quote') ||
    normalized.includes('proforma') ||
    normalized.includes('ارسال') ||
    normalized.includes('پیش')
  ) {
    return 'QUOTE_SENT';
  }
  if (normalized.includes('qualified') || normalized.includes('واجد')) return 'QUALIFIED';
  if (normalized.includes('warm') || normalized.includes('گرم') || normalized.includes('contacted')) return 'WARM';
  return 'COLD';
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function withClock(base: Date, hour: number, minute: number): Date {
  const value = new Date(base);
  value.setUTCHours(hour, minute, 0, 0);
  return value;
}

async function ensureDemoAccount(options: DemoAccountOptions) {
  const lookupEmails = [options.email, ...(options.legacyEmails ?? [])].filter(
    (value, index, array) => array.indexOf(value) === index
  );

  let user = await prisma.user.findFirst({
    where: {
      email: {
        in: lookupEmails,
      },
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: options.email,
        passwordHash: options.passwordHash,
        status: 'ACTIVE',
        ext: options.ext,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: options.email,
        passwordHash: options.passwordHash,
        status: 'ACTIVE',
        ext: options.ext,
      },
    });
  }

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: options.tenantId, userId: user.id },
    },
    update: {
      role: options.roleKey,
      roleId: options.roleId,
      status: 'ACTIVE',
    },
    create: {
      tenantId: options.tenantId,
      userId: user.id,
      role: options.roleKey,
      roleId: options.roleId,
      status: 'ACTIVE',
    },
  });

  return user;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: {},
    create: {
      slug: DEMO_TENANT_SLUG,
      name: 'تِنِنت دمو',
      status: 'ACTIVE',
    },
  });

  await ensureTenantRbac(prisma, tenant.id);

  const salesManagerRole = await prisma.role.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'SALES_MANAGER' } },
    select: { id: true },
  });
  const salesRepRole = await prisma.role.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'SALES_REP' } },
    select: { id: true },
  });

  if (!salesManagerRole || !salesRepRole) {
    throw new Error('SALES_MANAGER / SALES_REP roles were not provisioned for tenant');
  }

  const managerUser = await ensureDemoAccount({
    tenantId: tenant.id,
    email: DEMO_MANAGER_EMAIL,
    legacyEmails: [DEMO_MANAGER_LEGACY_EMAIL],
    passwordHash,
    roleKey: 'SALES_MANAGER',
    roleId: salesManagerRole.id,
    ext: '101',
  });

  const sellerUser = await ensureDemoAccount({
    tenantId: tenant.id,
    email: DEMO_SELLER_EMAIL,
    passwordHash,
    roleKey: 'SALES_REP',
    roleId: salesRepRole.id,
    ext: '102',
  });

  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id },
    include: { stages: { orderBy: { order: 'asc' } } },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'فروش',
        isDefault: true,
        stages: {
          create: [
            { tenantId: tenant.id, name: 'جدید', order: 0 },
            { tenantId: tenant.id, name: 'گرم', order: 1 },
            { tenantId: tenant.id, name: 'ارسال پیش‌فاکتور', order: 2 },
            { tenantId: tenant.id, name: 'بسته شده', order: 3 },
          ],
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  } else if (pipeline.stages.length < 4) {
    const stageNames = ['جدید', 'گرم', 'ارسال پیش‌فاکتور', 'بسته شده'];
    for (let i = 0; i < stageNames.length; i++) {
      const name = stageNames[i];
      const exists = pipeline.stages.some((s) => s.name === name);
      if (!exists) {
        await prisma.pipelineStage.create({
          data: { tenantId: tenant.id, pipelineId: pipeline.id, name, order: i },
        });
      }
    }

    const refetched = await prisma.pipeline.findFirst({
      where: { id: pipeline.id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    if (refetched) pipeline = refetched;
  }

  const canonicalStagePlan: Array<{ key: StageKey; name: string; order: number }> = [
    { key: 'COLD', name: 'سرد', order: 0 },
    { key: 'WARM', name: 'گرم', order: 1 },
    { key: 'QUALIFIED', name: 'واجد شرایط', order: 2 },
    { key: 'QUOTE_SENT', name: 'ارسال پیش‌فاکتور', order: 3 },
    { key: 'NEGOTIATION', name: 'مذاکره', order: 4 },
    { key: 'SIGNED_CONTRACT', name: 'قرارداد امضاشده', order: 5 },
  ];

  for (const stage of canonicalStagePlan) {
    const exists = pipeline.stages.some((item) => detectStageKey(item.name) === stage.key);
    if (!exists) {
      await prisma.pipelineStage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          name: stage.name,
          order: stage.order,
        },
      });
    }
  }

  const reloadedPipeline = await prisma.pipeline.findFirst({
    where: { id: pipeline.id },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (reloadedPipeline) pipeline = reloadedPipeline;

  const stageByKey = new Map<StageKey, (typeof pipeline.stages)[number]>();
  for (const stage of pipeline.stages) {
    const key = detectStageKey(stage.name);
    if (!stageByKey.has(key)) stageByKey.set(key, stage);
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const demoProducts = [
    { code: 'CRM-CORE', name: 'لایسنس CRM پایه', unit: 'لایسنس', basePrice: 12_000_000, category: 'Subscription' },
    { code: 'CRM-PRO', name: 'لایسنس CRM حرفه‌ای', unit: 'لایسنس', basePrice: 18_000_000, category: 'Subscription' },
    { code: 'ONBOARD', name: 'راه‌اندازی و استقرار', unit: 'پروژه', basePrice: 25_000_000, category: 'Service' },
    { code: 'TRAINING', name: 'آموزش تیم فروش', unit: 'ساعت', basePrice: 1_800_000, category: 'Service' },
    { code: 'SUPPORT', name: 'پشتیبانی ویژه', unit: 'ماه', basePrice: 3_200_000, category: 'Support' },
  ] as const;

  for (const product of demoProducts) {
    await prisma.auditLog.deleteMany({
      where: {
        tenantId: tenant.id,
        entityType: 'PRODUCT',
        entityId: product.code,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: managerUser.id,
        action: 'UPSERT',
        entityType: 'PRODUCT',
        entityId: product.code,
        metaJson: {
          ...product,
          isActive: true,
          updatedAt: now.toISOString(),
        },
      },
    });
  }

  const toMoney = (value: number) => Math.round(value);
  const buildSeedLine = (
    seed: number,
    product: (typeof demoProducts)[number],
    quantity: number,
    discountPct: number,
    taxPct: number
  ) => {
    const lineSubtotal = toMoney(quantity * product.basePrice);
    const lineDiscountAmount = toMoney((lineSubtotal * discountPct) / 100);
    const taxableBase = Math.max(0, lineSubtotal - lineDiscountAmount);
    const lineTaxAmount = toMoney((taxableBase * taxPct) / 100);
    const lineTotal = taxableBase + lineTaxAmount;
    return {
      tenantId: tenant.id,
      productCode: product.code,
      productName: product.name,
      unit: product.unit,
      quantity: Number(quantity.toFixed(3)),
      unitPrice: product.basePrice,
      discountPct: Number(discountPct.toFixed(2)),
      taxPct: Number(taxPct.toFixed(2)),
      lineSubtotal,
      lineDiscountAmount,
      lineTaxAmount,
      lineTotal,
      position: seed,
    };
  };

  const ensureDealItems = async (dealId: string, seedIndex: number) => {
    const existingCount = await prisma.dealItem.count({ where: { tenantId: tenant.id, dealId } });
    if (existingCount > 0) return;

    const first = demoProducts[seedIndex % demoProducts.length];
    const second = demoProducts[(seedIndex + 1) % demoProducts.length];
    const third = demoProducts[(seedIndex + 2) % demoProducts.length];

    const lines = [
      buildSeedLine(0, first, 1 + (seedIndex % 3), seedIndex % 2 === 0 ? 5 : 0, 10),
      buildSeedLine(1, second, 1 + ((seedIndex + 1) % 2), 0, 10),
      buildSeedLine(2, third, 2 + (seedIndex % 4), 3, 10),
    ].map((line) => ({ ...line, dealId }));

    await prisma.dealItem.createMany({ data: lines });

    const summary = lines.reduce(
      (acc, line) => {
        acc.subtotal += line.lineSubtotal;
        acc.discountAmount += line.lineDiscountAmount;
        acc.taxAmount += line.lineTaxAmount;
        acc.amount += line.lineTotal;
        return acc;
      },
      { subtotal: 0, discountAmount: 0, taxAmount: 0, amount: 0 }
    );

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        subtotal: summary.subtotal,
        discountAmount: summary.discountAmount,
        taxAmount: summary.taxAmount,
        amount: summary.amount,
      },
    });
  };

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planCode: 'CRM_ANNUAL',
      status: 'ACTIVE',
      startsAt: now,
      endsAt: oneYearLater,
      baseSeatLimit: 20,
      addonSeatCount: 0,
    },
  });

  let company = await prisma.company.findFirst({
    where: { tenantId: tenant.id, name: 'آلفا دیزاین' },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'آلفا دیزاین',
        website: 'https://alfadezign.ir',
        phone: null,
      },
    });
  }

  let contact = await prisma.contact.findFirst({
    where: { tenantId: tenant.id, firstName: 'علی', lastName: 'رضایی' },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        firstName: 'علی',
        lastName: 'رضایی',
        phone: '09121234567',
        email: 'ali@example.com',
        companyId: company.id,
      },
    });
  }

  const stagePreInvoice = stageByKey.get('QUOTE_SENT') ?? pipeline.stages[0];

  let deal = await prisma.deal.findFirst({
    where: { tenantId: tenant.id, title: 'CRM ویژه آلفا' },
  });

  if (!deal) {
    deal = await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        title: 'CRM ویژه آلفا',
        amount: 75_000_000,
        stageId: stagePreInvoice.id,
        pipelineId: pipeline.id,
        contactId: contact.id,
        companyId: company.id,
        ownerUserId: sellerUser.id,
      },
    });
  } else if (deal.ownerUserId !== sellerUser.id) {
    deal = await prisma.deal.update({
      where: { id: deal.id },
      data: { ownerUserId: sellerUser.id },
    });
  }

  let task = await prisma.task.findFirst({
    where: { tenantId: tenant.id, title: 'پیگیری ارسال قرارداد' },
  });

  if (!task) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        title: 'پیگیری ارسال قرارداد',
        dueAt: tomorrow,
        status: 'today',
        dealId: deal.id,
        contactId: contact.id,
        assignedToUserId: sellerUser.id,
        createdByUserId: managerUser.id,
      },
    });
  } else if (task.assignedToUserId !== sellerUser.id || task.createdByUserId !== managerUser.id) {
    task = await prisma.task.update({
      where: { id: task.id },
      data: {
        assignedToUserId: sellerUser.id,
        createdByUserId: managerUser.id,
      },
    });
  }

  await ensureDealItems(deal.id, 0);

  const existingActivity = await prisma.activity.findFirst({
    where: {
      tenantId: tenant.id,
      contactId: contact.id,
      dealId: deal.id,
      type: 'CALL',
    },
  });

  if (!existingActivity) {
    await prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'CALL',
        body: 'معرفی قابلیت‌های پنل فروش. نتیجه: موفق.',
        happenedAt: now,
        contactId: contact.id,
        dealId: deal.id,
      },
    });
  }

  const activeMembers = await prisma.membership.findMany({
    where: {
      tenantId: tenant.id,
      status: 'ACTIVE',
      role: { in: ['ADMIN', 'SALES_MANAGER', 'SALES_REP'] },
    },
    select: { userId: true, role: true },
    orderBy: { userId: 'asc' },
  });
  const ownerUserIds = Array.from(new Set(activeMembers.map((item) => item.userId)));
  if (ownerUserIds.length === 0) ownerUserIds.push(managerUser.id, sellerUser.id);

  const demoCompanyNames = [
    'DEMO_سپهر سیستم',
    'DEMO_ابر داده',
    'DEMO_پارس تجارت',
    'DEMO_راهکار نوین',
    'DEMO_هلیا سرویس',
    'DEMO_فناوران آینده',
    'DEMO_آرمان دیجیتال',
    'DEMO_پویش افزار',
    'DEMO_راهان تجارت',
    'DEMO_نگین پرداز',
  ];

  const demoCompanies: Array<{ id: string; name: string }> = [company];
  for (let i = 0; i < demoCompanyNames.length; i++) {
    const name = demoCompanyNames[i];
    let record = await prisma.company.findFirst({ where: { tenantId: tenant.id, name } });
    if (!record) {
      record = await prisma.company.create({
        data: {
          tenantId: tenant.id,
          name,
          website: `https://demo-${i + 1}.example.com`,
        },
      });
    }
    demoCompanies.push(record);
  }

  const contactFirstNames = [
    'نیما',
    'سارا',
    'امیر',
    'نگین',
    'محمد',
    'الهام',
    'رضا',
    'رها',
    'مهدی',
    'ستاره',
    'آیدا',
    'یاسمن',
    'عرفان',
    'لیلا',
    'پیمان',
    'نسترن',
    'حمید',
    'الناز',
    'آرش',
    'غزل',
  ];
  const contactLastNames = [
    'جعفری',
    'موسوی',
    'حیدری',
    'شریفی',
    'قاسمی',
    'احمدی',
    'کریمی',
    'طالبی',
    'بهرامی',
    'قنبری',
    'یزدانی',
    'بیات',
    'نصیری',
    'حسینی',
    'رستمی',
    'یوسفی',
    'جلالی',
    'کاظمی',
    'نیازی',
    'هاشمی',
  ];

  const demoContacts: Array<{ id: string; firstName: string; lastName: string; companyId: string | null }> = [contact];
  for (let i = 0; i < 20; i++) {
    const phone = `0912100${String(i + 1).padStart(4, '0')}`;
    const firstName = contactFirstNames[i % contactFirstNames.length];
    const lastName = contactLastNames[i % contactLastNames.length];
    const companyRef = demoCompanies[(i % (demoCompanies.length - 1)) + 1] ?? null;
    const ownerUserId = ownerUserIds[i % ownerUserIds.length] ?? sellerUser.id;

    let record = await prisma.contact.findFirst({ where: { tenantId: tenant.id, phone } });
    if (!record) {
      record = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          phone,
          email: i % 4 === 0 ? `${firstName}.${lastName}@example.com`.toLowerCase() : null,
          companyId: i % 5 === 0 ? null : companyRef?.id ?? null,
          ownerUserId,
        },
      });
    }
    demoContacts.push(record);
  }

  const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST'] as const;
  const leadSources = ['سایت', 'تبلیغ', 'تماس'] as const;
  for (let i = 0; i < 30; i++) {
    const phone = `0912300${String(i + 100).padStart(4, '0')}`;
    const status = leadStatuses[i % leadStatuses.length];
    const ownerUserId = ownerUserIds[i % ownerUserIds.length] ?? sellerUser.id;
    const followUpAt =
      status === 'LOST'
        ? null
        : addDays(now, (i % 9) - 4); // some overdue, some future

    const exists = await prisma.lead.findFirst({ where: { tenantId: tenant.id, phone } });
    if (!exists) {
      await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          firstName: 'لید',
          lastName: `DEMO_${i + 1}`,
          phone,
          email: `demo.lead.${i + 1}@example.com`,
          companyName: i % 2 === 0 ? demoCompanies[(i % demoCompanies.length)].name : null,
          source: leadSources[i % leadSources.length],
          status,
          notes: `سرنخ دمو شماره ${i + 1}`,
          followUpAt,
          ownerUserId,
        },
      });
    }
  }

  const dealStageKeys: StageKey[] = ['COLD', 'WARM', 'QUALIFIED', 'QUOTE_SENT', 'NEGOTIATION', 'SIGNED_CONTRACT'];
  const seededDeals: Array<{ id: string; title: string; ownerUserId: string | null; companyId: string | null; contactId: string | null }> = [deal];
  for (let i = 0; i < 24; i++) {
    const title = `DEMO_فرصت فروش ${i + 1}`;
    const existingDeal = await prisma.deal.findFirst({ where: { tenantId: tenant.id, title } });
    if (existingDeal) {
      seededDeals.push(existingDeal);
      await ensureDealItems(existingDeal.id, i + 1);
      continue;
    }

    const stageKey = dealStageKeys[i % dealStageKeys.length];
    const stage = stageByKey.get(stageKey) ?? pipeline.stages[0];
    const companyRef = demoCompanies[i % demoCompanies.length] ?? company;
    const contactRef = demoContacts[i % demoContacts.length] ?? contact;
    const ownerUserId = ownerUserIds[i % ownerUserIds.length] ?? sellerUser.id;
    const amount = 25_000_000 + i * 5_000_000;
    const sentAt =
      stageKey === 'QUOTE_SENT' || stageKey === 'NEGOTIATION' || stageKey === 'SIGNED_CONTRACT'
        ? addDays(now, -((i % 10) + 1))
        : null;
    const expectedCloseDate =
      stageKey === 'SIGNED_CONTRACT'
        ? addDays(now, -(i % 6))
        : addDays(now, (i % 12) - 2);

    const createdDeal = await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        title,
        amount,
        stageId: stage.id,
        pipelineId: pipeline.id,
        contactId: contactRef?.id ?? null,
        companyId: companyRef?.id ?? null,
        ownerUserId,
        sentAt,
        expectedCloseDate,
      },
      select: { id: true, title: true, ownerUserId: true, companyId: true, contactId: true },
    });
    await ensureDealItems(createdDeal.id, i + 1);
    seededDeals.push(createdDeal);
  }

  const taskStatuses = ['today', 'in_progress', 'waiting', 'done', 'backlog'] as const;
  for (let i = 0; i < 20; i++) {
    const title = `DEMO_وظیفه پیگیری ${i + 1}`;
    const exists = await prisma.task.findFirst({ where: { tenantId: tenant.id, title } });
    if (exists) continue;

    const ownerUserId = ownerUserIds[i % ownerUserIds.length] ?? sellerUser.id;
    const dealRef = seededDeals[i % seededDeals.length] ?? deal;
    const contactRef = demoContacts[i % demoContacts.length] ?? contact;
    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        title,
        dueAt: addDays(now, (i % 10) - 5),
        status: taskStatuses[i % taskStatuses.length],
        priority: i % 5 === 0 ? 'HIGH' : 'MEDIUM',
        assignedToUserId: ownerUserId,
        createdByUserId: managerUser.id,
        contactId: contactRef?.id ?? null,
        dealId: i % 2 === 0 ? dealRef?.id ?? null : null,
      },
    });
  }

  const activityTypes = ['CALL', 'MEETING', 'NOTE'] as const;
  for (let i = 0; i < 25; i++) {
    const body = `DEMO_فعالیت ${i + 1} برای دمو`;
    const exists = await prisma.activity.findFirst({ where: { tenantId: tenant.id, body } });
    if (exists) continue;

    const dealRef = seededDeals[i % seededDeals.length] ?? deal;
    const contactRef = demoContacts[i % demoContacts.length] ?? contact;
    const creatorUserId = ownerUserIds[i % ownerUserIds.length] ?? managerUser.id;
    await prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: activityTypes[i % activityTypes.length],
        contactId: contactRef?.id ?? null,
        dealId: i % 2 === 0 ? dealRef?.id ?? null : null,
        body,
        happenedAt: addDays(now, -i),
        createdByUserId: creatorUserId,
      },
    });
  }

  const todoUsers = [managerUser.id, sellerUser.id];
  for (let i = 0; i < 8; i++) {
    const userId = todoUsers[i % todoUsers.length];
    const title = `DEMO_تودو ${i + 1}`;
    const exists = await prisma.todo.findFirst({ where: { tenantId: tenant.id, userId, title } });
    if (exists) continue;
    await prisma.todo.create({
      data: {
        tenantId: tenant.id,
        userId,
        title,
        dueAt: addDays(now, (i % 6) - 2),
        status: i % 3 === 0 ? 'DONE' : 'OPEN',
      },
    });
  }

  const demoAgents = [
    { userId: managerUser.id, ext: managerUser.ext ?? '101' },
    { userId: sellerUser.id, ext: sellerUser.ext ?? '102' },
  ];

  for (const agent of demoAgents) {
    if (!agent.ext?.trim()) continue;
    const rows = Array.from({ length: 20 }).map((_, index) => {
      const startedAt = withClock(addDays(now, -(index % 14)), 8 + (index % 10), (index * 7) % 60);
      const direction: 'INBOUND' | 'OUTBOUND' = index % 2 === 0 ? 'INBOUND' : 'OUTBOUND';
      const externalNumber = `09${String(100000000 + index * 3791).slice(0, 9)}`;
      const answered = index % 4 !== 0;

      if (answered) {
        const ringSec = 5 + (index % 6);
        const durationSec = 70 + ((index * 31) % 420);
        const answeredAt = new Date(startedAt.getTime() + ringSec * 1000);
        const endedAt = new Date(answeredAt.getTime() + durationSec * 1000);

        return {
          tenantId: tenant.id,
          direction,
          fromNumber: direction === 'INBOUND' ? externalNumber : agent.ext,
          toNumber: direction === 'INBOUND' ? agent.ext : externalNumber,
          agentUserId: agent.userId,
          answeredByUserId: agent.userId,
          status: 'ENDED' as const,
          startedAt,
          answeredAt,
          endedAt,
          durationSec,
          ext: agent.ext,
          recordingUrl: `https://mock-voip.local/recordings/seed-${agent.userId}-${index}.mp3`,
          providerCallId: `seed-${tenant.id}-${agent.userId}-${index}`,
        };
      }

      const failed = index % 10 === 0;
      const endedAt = new Date(startedAt.getTime() + (failed ? 12 : 18) * 1000);

      return {
        tenantId: tenant.id,
        direction,
        fromNumber: direction === 'INBOUND' ? externalNumber : agent.ext,
        toNumber: direction === 'INBOUND' ? agent.ext : externalNumber,
        agentUserId: agent.userId,
        answeredByUserId: null,
        status: failed ? ('FAILED' as const) : ('MISSED' as const),
        startedAt,
        answeredAt: null,
        endedAt,
        durationSec: failed ? null : 0,
        ext: agent.ext,
        recordingUrl: null,
        providerCallId: `seed-${tenant.id}-${agent.userId}-${index}`,
      };
    });

    await prisma.callLog.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  const smsTemplateFollowUp = await prisma.smsTemplate.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'پیگیری سرنخ جدید',
      },
    },
    update: {
      body: 'سلام، برای پیگیری درخواست شما تماس می‌گیریم. لطفا زمان مناسب را اعلام کنید.',
      isActive: true,
      createdByUserId: managerUser.id,
    },
    create: {
      tenantId: tenant.id,
      name: 'پیگیری سرنخ جدید',
      body: 'سلام، برای پیگیری درخواست شما تماس می‌گیریم. لطفا زمان مناسب را اعلام کنید.',
      isActive: true,
      createdByUserId: managerUser.id,
    },
  });

  const smsTemplateReminder = await prisma.smsTemplate.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'یادآوری جلسه فروش',
      },
    },
    update: {
      body: 'یادآوری: جلسه فروش شما امروز برگزار می‌شود. لطفا در زمان مقرر در دسترس باشید.',
      isActive: true,
      createdByUserId: managerUser.id,
    },
    create: {
      tenantId: tenant.id,
      name: 'یادآوری جلسه فروش',
      body: 'یادآوری: جلسه فروش شما امروز برگزار می‌شود. لطفا در زمان مقرر در دسترس باشید.',
      isActive: true,
      createdByUserId: managerUser.id,
    },
  });

  const smsSeedUsers = [managerUser, sellerUser];
  for (const smsUser of smsSeedUsers) {
    const smsRows = Array.from({ length: 30 }).map((_, index) => {
      const queuedAt = withClock(addDays(now, -(index % 12)), 8 + (index % 10), (index * 11) % 60);
      let status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' = 'DELIVERED';
      if (index % 13 === 0) status = 'FAILED';
      else if (index % 7 === 0) status = 'QUEUED';
      else if (index % 5 === 0) status = 'SENT';

      const sentAt = status === 'QUEUED' ? null : new Date(queuedAt.getTime() + 30 * 1000);
      const deliveredAt = status === 'DELIVERED' && sentAt ? new Date(sentAt.getTime() + 60 * 1000) : null;
      const failedAt = status === 'FAILED' && sentAt ? new Date(sentAt.getTime() + 45 * 1000) : null;
      const template = index % 2 === 0 ? smsTemplateFollowUp : smsTemplateReminder;
      const source = index % 3 === 0 ? 'BULK' : 'SINGLE';

      return {
        tenantId: tenant.id,
        createdByUserId: smsUser.id,
        senderLine: 'Sakhtar',
        recipientPhone: `09124${String(100000 + index).slice(0, 6)}`,
        recipientName: `مشتری دمو ${index + 1}`,
        body: template.body,
        status,
        source,
        campaignKey: source === 'BULK' ? `seed-campaign-${smsUser.id}` : null,
        providerMessageId: `seed-sms-${tenant.id}-${smsUser.id}-${index}`,
        errorMessage: status === 'FAILED' ? 'MOCK_PROVIDER_DELIVERY_FAILURE' : null,
        templateId: template.id,
        queuedAt,
        sentAt,
        deliveredAt,
        failedAt,
      };
    });

    await prisma.smsLog.createMany({
      data: smsRows,
      skipDuplicates: true,
    });
  }

  console.log(
    `Seed OK: tenant=${DEMO_TENANT_SLUG}, manager=${DEMO_MANAGER_EMAIL}, seller=${DEMO_SELLER_EMAIL}, dashboard demo data created (leads/deals/tasks/activities/todos/calls/sms)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
