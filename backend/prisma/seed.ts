/**
 * Seed دمو: Tenant با slug `demo`، کاربر OWNER، Membership.
 * اجرا: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const isProd = process.env.NODE_ENV === 'production';
const allowDemoSeed = process.env.ALLOW_DEMO_SEED === 'true';

// روی production به صورت پیش‌فرض seed را قطع کن
if (isProd && !allowDemoSeed) {
  console.error(
    '[seed] Refusing to run demo seed in production. Set ALLOW_DEMO_SEED=true to override (not recommended).'
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const DEMO_TENANT_SLUG = 'demo';
const DEMO_USER_EMAIL = 'owner@demo.com';
const DEMO_USER_PASSWORD = '12345678';

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

  let user = await prisma.user.findFirst({
    where: { email: DEMO_USER_EMAIL },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEMO_USER_EMAIL,
        passwordHash,
        status: 'ACTIVE',
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: user.id },
    },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
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

  // اشتراک دمو (برای صفحه Billing: Basic فعال، صندلی 1/20)
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
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

  // دیتای دمو: شرکت آلفا دیزاین، مخاطب علی رضایی، معامله، کار، فعالیت (طبق docs/specs/DEMO-ADMIN.md)
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

  const stagePreInvoice = pipeline.stages.find((s) => s.name === 'ارسال پیش‌فاکتور') ?? pipeline.stages[0];
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
        ownerUserId: user.id,
      },
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
        status: 'OPEN',
        dealId: deal.id,
        contactId: contact.id,
      },
    });
  }

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

  console.log('Seed OK: tenant demo, owner@demo.com / 12345678, دیتای دمو (آلفا دیزاین، علی رضایی، معامله، کار، فعالیت)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
