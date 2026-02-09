/**
 * Seed دمو: Tenant با slug `demo`، کاربر OWNER، Membership.
 * اجرا: npx prisma db seed
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_TENANT_SLUG = 'demo';
const DEMO_USER_PASSWORD = '12345678';
const DEMO_PREFIX = 'DEMO_';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.upsert({
      where: { slug: DEMO_TENANT_SLUG },
      update: {},
      create: {
        slug: DEMO_TENANT_SLUG,
        name: 'تِنِنت دمو',
        status: 'ACTIVE',
      },
    });

    const ensureUser = async (input: {
      phone: string;
      email?: string;
      displayName: string;
      firstName?: string;
      lastName?: string;
      role: 'OWNER' | 'MEMBER';
    }) => {
      const existing = await tx.user.findFirst({
        where: { phone: input.phone },
      });
      const data = {
        phone: input.phone,
        email: input.email ?? null,
        displayName: input.displayName,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        passwordHash,
        status: 'ACTIVE',
      };
      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data })
        : await tx.user.create({ data });

      await tx.membership.upsert({
        where: {
          tenantId_userId: { tenantId: tenant.id, userId: user.id },
        },
        update: { role: input.role, status: 'ACTIVE' },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          role: input.role,
          status: 'ACTIVE',
        },
      });

      return user;
    };

    const ownerUser = await ensureUser({
      phone: '09120000001',
      email: 'owner@demo.com',
      displayName: 'علی محمدی',
      firstName: 'علی',
      lastName: 'محمدی',
      role: 'OWNER',
    });
    const member1 = await ensureUser({
      phone: '09120000002',
      displayName: 'سارا رضایی',
      firstName: 'سارا',
      lastName: 'رضایی',
      role: 'MEMBER',
    });
    const member2 = await ensureUser({
      phone: '09120000003',
      displayName: 'حسین کریمی',
      firstName: 'حسین',
      lastName: 'کریمی',
      role: 'MEMBER',
    });
    const member3 = await ensureUser({
      phone: '09120000004',
      displayName: 'مینا احمدی',
      firstName: 'مینا',
      lastName: 'احمدی',
      role: 'MEMBER',
    });
    const member4 = await ensureUser({
      phone: '09120000005',
      displayName: 'امیرحسین نوری',
      firstName: 'امیرحسین',
      lastName: 'نوری',
      role: 'MEMBER',
    });
    const member5 = await ensureUser({
      phone: '09120000006',
      displayName: 'نرگس حسینی',
      firstName: 'نرگس',
      lastName: 'حسینی',
      role: 'MEMBER',
    });

    let pipeline = await tx.pipeline.findFirst({
      where: { tenantId: tenant.id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    if (!pipeline) {
      pipeline = await tx.pipeline.create({
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
          await tx.pipelineStage.create({
            data: { tenantId: tenant.id, pipelineId: pipeline.id, name, order: i },
          });
        }
      }
      const refetched = await tx.pipeline.findFirst({
        where: { id: pipeline.id },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      if (refetched) pipeline = refetched;
    }

    // اشتراک دمو (برای صفحه Billing: Basic فعال، صندلی 1/20)
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    await tx.subscription.upsert({
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
    let company = await tx.company.findFirst({
      where: { tenantId: tenant.id, name: 'آلفا دیزاین' },
    });
    if (!company) {
      company = await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: 'آلفا دیزاین',
          website: 'https://alfadezign.ir',
          phone: null,
        },
      });
    }

    let contact = await tx.contact.findFirst({
      where: { tenantId: tenant.id, firstName: 'علی', lastName: 'رضایی' },
    });
    if (!contact) {
      contact = await tx.contact.create({
        data: {
          tenantId: tenant.id,
          firstName: 'علی',
          lastName: 'رضایی',
          phone: '09121234567',
          email: 'ali@example.com',
          companyId: company.id,
          ownerUserId: ownerUser.id,
        },
      });
    }

    const stagePreInvoice =
      pipeline.stages.find((s) => s.name === 'ارسال پیش‌فاکتور') ?? pipeline.stages[0];
    let deal = await tx.deal.findFirst({
      where: { tenantId: tenant.id, title: 'CRM ویژه آلفا' },
    });
    if (!deal) {
      deal = await tx.deal.create({
        data: {
          tenantId: tenant.id,
          title: 'CRM ویژه آلفا',
          amount: 75_000_000,
          stageId: stagePreInvoice.id,
          pipelineId: pipeline.id,
          contactId: contact.id,
          companyId: company.id,
          ownerUserId: ownerUser.id,
        },
      });
    }

    let task = await tx.task.findFirst({
      where: { tenantId: tenant.id, title: 'پیگیری ارسال قرارداد' },
    });
    if (!task) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      task = await tx.task.create({
        data: {
          tenantId: tenant.id,
          title: 'پیگیری ارسال قرارداد',
          dueAt: tomorrow,
          status: 'OPEN',
          dealId: deal.id,
          contactId: contact.id,
          assignedToUserId: member1.id,
        },
      });
    }

    const existingActivity = await tx.activity.findFirst({
      where: {
        tenantId: tenant.id,
        contactId: contact.id,
        dealId: deal.id,
        type: 'CALL',
      },
    });
    if (!existingActivity) {
      await tx.activity.create({
        data: {
          tenantId: tenant.id,
          type: 'CALL',
          body: 'معرفی قابلیت‌های پنل فروش. نتیجه: موفق.',
          happenedAt: now,
          contactId: contact.id,
          dealId: deal.id,
          createdByUserId: ownerUser.id,
        },
      });
    }

    const ensureCompany = async (data: {
      name: string;
      phone?: string;
      website?: string;
    }) => {
      const existing = await tx.company.findFirst({
        where: { tenantId: tenant.id, name: data.name },
      });
      if (existing) return existing;
      return tx.company.create({
        data: {
          tenantId: tenant.id,
          name: data.name,
          phone: data.phone ?? null,
          website: data.website ?? null,
        },
      });
    };

    const ensureContact = async (data: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      companyId?: string;
      ownerUserId?: string;
    }) => {
      const existing = await tx.contact.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            data.phone ? { phone: data.phone } : undefined,
            { firstName: data.firstName, lastName: data.lastName, email: data.email ?? undefined },
          ].filter(Boolean) as Prisma.ContactWhereInput[],
        },
      });
      if (existing) return existing;
      return tx.contact.create({
        data: {
          tenantId: tenant.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          email: data.email ?? null,
          companyId: data.companyId ?? null,
          ownerUserId: data.ownerUserId ?? null,
        },
      });
    };

    const ensureLead = async (data: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      companyName?: string;
      source?: string;
      status: string;
      notes?: string;
      followUpAt?: Date;
      ownerUserId?: string;
    }) => {
      const existing = await tx.lead.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            data.phone ? { phone: data.phone } : undefined,
            { firstName: data.firstName, lastName: data.lastName, email: data.email ?? undefined },
          ].filter(Boolean) as Prisma.LeadWhereInput[],
        },
      });
      if (existing) return existing;
      return tx.lead.create({
        data: {
          tenantId: tenant.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          email: data.email ?? null,
          companyName: data.companyName ?? null,
          source: data.source ?? null,
          status: data.status,
          notes: data.notes ?? null,
          followUpAt: data.followUpAt ?? null,
          ownerUserId: data.ownerUserId ?? null,
        },
      });
    };

    const ensureDeal = async (data: {
      title: string;
      amount?: number;
      stageId: string;
      pipelineId: string;
      contactId?: string;
      companyId?: string;
      ownerUserId?: string;
      expectedCloseDate?: Date;
    }) => {
      const existing = await tx.deal.findFirst({
        where: { tenantId: tenant.id, title: data.title },
      });
      if (existing) return existing;
      return tx.deal.create({
        data: {
          tenantId: tenant.id,
          title: data.title,
          amount: data.amount ? new Prisma.Decimal(data.amount) : null,
          stageId: data.stageId,
          pipelineId: data.pipelineId,
          contactId: data.contactId ?? null,
          companyId: data.companyId ?? null,
          ownerUserId: data.ownerUserId ?? null,
          expectedCloseDate: data.expectedCloseDate ?? null,
        },
      });
    };

    const ensureTask = async (data: {
      title: string;
      dueAt?: Date;
      status: string;
      assignedToUserId?: string;
      contactId?: string;
      dealId?: string;
    }) => {
      const existing = await tx.task.findFirst({
        where: { tenantId: tenant.id, title: data.title },
      });
      if (existing) return existing;
      return tx.task.create({
        data: {
          tenantId: tenant.id,
          title: data.title,
          dueAt: data.dueAt ?? null,
          status: data.status,
          assignedToUserId: data.assignedToUserId ?? null,
          contactId: data.contactId ?? null,
          dealId: data.dealId ?? null,
        },
      });
    };

    const ensureActivity = async (data: {
      type: string;
      body: string;
      happenedAt: Date;
      createdByUserId?: string;
      contactId?: string;
      dealId?: string;
    }) => {
      const existing = await tx.activity.findFirst({
        where: {
          tenantId: tenant.id,
          type: data.type,
          body: data.body,
          contactId: data.contactId ?? null,
          dealId: data.dealId ?? null,
        },
      });
      if (existing) return existing;
      return tx.activity.create({
        data: {
          tenantId: tenant.id,
          type: data.type,
          body: data.body,
          happenedAt: data.happenedAt,
          createdByUserId: data.createdByUserId ?? null,
          contactId: data.contactId ?? null,
          dealId: data.dealId ?? null,
        },
      });
    };

    const companiesData = [
      { name: `${DEMO_PREFIX}سپهر سیستم`, website: 'https://sepehrsys.ir' },
      { name: `${DEMO_PREFIX}ابر داده`, website: 'https://abrdata.ir' },
      { name: `${DEMO_PREFIX}پارس تجارت`, website: 'https://parstejarat.ir' },
      { name: `${DEMO_PREFIX}راهکار نوین`, website: 'https://rahkar.com' },
      { name: `${DEMO_PREFIX}هلیا سرویس`, website: 'https://helia.ir' },
      { name: `${DEMO_PREFIX}فناوران آینده`, website: 'https://fanavaran.ir' },
      { name: `${DEMO_PREFIX}آرمان دیجیتال`, website: 'https://armandigital.ir' },
      { name: `${DEMO_PREFIX}پویش افزار`, website: 'https://poyeshafzar.ir' },
      { name: `${DEMO_PREFIX}راهان تجارت`, website: 'https://rahan.ir' },
      { name: `${DEMO_PREFIX}نگین پرداز`, website: 'https://neginpardaz.ir' },
    ];
    const companies = [];
    for (const c of companiesData) {
      companies.push(await ensureCompany(c));
    }

    const users = [ownerUser, member1, member2, member3, member4, member5];
    const contactsData = [
      { firstName: 'نیما', lastName: 'جعفری', phone: '09121000001', companyId: companies[0].id },
      { firstName: 'سارا', lastName: 'موسوی', phone: '09121000002', companyId: companies[1].id },
      { firstName: 'امیر', lastName: 'حیدری', phone: '09121000003', companyId: companies[2].id },
      { firstName: 'نگین', lastName: 'شریفی', phone: '09121000004', companyId: companies[3].id },
      { firstName: 'محمد', lastName: 'قاسمی', phone: '09121000005', companyId: companies[4].id },
      { firstName: 'الهام', lastName: 'احمدی', phone: '09121000006', companyId: companies[5].id },
      { firstName: 'رضا', lastName: 'کریمی', phone: '09121000007', companyId: companies[6].id },
      { firstName: 'رها', lastName: 'طالبی', phone: '09121000008', companyId: companies[7].id },
      { firstName: 'مهدی', lastName: 'بهرامی', phone: '09121000009', companyId: companies[8].id },
      { firstName: 'ستاره', lastName: 'قنبری', phone: '09121000010', companyId: companies[9].id },
      { firstName: 'آیدا', lastName: 'یزدانی', phone: '09121000011', companyId: companies[0].id },
      { firstName: 'یاسمن', lastName: 'بیات', phone: '09121000012', companyId: companies[1].id },
      { firstName: 'عرفان', lastName: 'نصیری', phone: '09121000013', companyId: companies[2].id },
      { firstName: 'لیلا', lastName: 'حسینی', phone: '09121000014', companyId: companies[3].id },
      { firstName: 'پیمان', lastName: 'رستمی', phone: '09121000015' },
      { firstName: 'نسترن', lastName: 'یوسفی', phone: '09121000016' },
      { firstName: 'حمید', lastName: 'جلالی', phone: '09121000017' },
      { firstName: 'الناز', lastName: 'کاظمی', phone: '09121000018' },
      { firstName: 'آرش', lastName: 'نیازی', phone: '09121000019' },
      { firstName: 'غزل', lastName: 'هاشمی', phone: '09121000020' },
    ];
    const contacts = [];
    for (let i = 0; i < contactsData.length; i++) {
      const owner = users[i % users.length];
      contacts.push(await ensureContact({ ...contactsData[i], ownerUserId: owner.id }));
    }

    const stages = pipeline.stages;
    const dealsData = [
      { title: `${DEMO_PREFIX}قرارداد CRM سپهر`, amount: 120_000_000, stageIndex: 0, contactIndex: 0, companyIndex: 0 },
      { title: `${DEMO_PREFIX}پیاده‌سازی فروش پارس`, amount: 95_000_000, stageIndex: 1, contactIndex: 1, companyIndex: 1 },
      { title: `${DEMO_PREFIX}اتوماسیون ابر داده`, amount: 60_000_000, stageIndex: 2, contactIndex: 2, companyIndex: 2 },
      { title: `${DEMO_PREFIX}ارتقا ماژول راهکار`, amount: 45_000_000, stageIndex: 3, contactIndex: 3, companyIndex: 3 },
      { title: `${DEMO_PREFIX}پشتیبانی سالانه هلیا`, amount: 30_000_000, stageIndex: 1, contactIndex: 4, companyIndex: 4 },
      { title: `${DEMO_PREFIX}راه‌اندازی داشبورد آینده`, amount: 80_000_000, stageIndex: 0, contactIndex: 5, companyIndex: 5 },
      { title: `${DEMO_PREFIX}مدیریت لید آرمان`, amount: 55_000_000, stageIndex: 2, contactIndex: 6, companyIndex: 6 },
      { title: `${DEMO_PREFIX}نسخه اختصاصی پویش`, amount: 110_000_000, stageIndex: 3, contactIndex: 7, companyIndex: 7 },
      { title: `${DEMO_PREFIX}یکپارچه‌سازی راهان`, amount: 70_000_000, stageIndex: 1, contactIndex: 8, companyIndex: 8 },
      { title: `${DEMO_PREFIX}سفارشی‌سازی نگین`, amount: 50_000_000, stageIndex: 0, contactIndex: 9, companyIndex: 9 },
      { title: `${DEMO_PREFIX}تمدید قرارداد سپهر`, amount: 40_000_000, stageIndex: 2, contactIndex: 10, companyIndex: 0 },
      { title: `${DEMO_PREFIX}مشاوره فروش پارس`, amount: 25_000_000, stageIndex: 1, contactIndex: 11, companyIndex: 1 },
      { title: `${DEMO_PREFIX}ماژول گزارشات ابر`, amount: 35_000_000, stageIndex: 0, contactIndex: 12, companyIndex: 2 },
      { title: `${DEMO_PREFIX}پروژه سریع راهکار`, amount: 28_000_000, stageIndex: 3, contactIndex: 13, companyIndex: 3 },
      { title: `${DEMO_PREFIX}لایسنس تیمی هلیا`, amount: 65_000_000, stageIndex: 2, contactIndex: 14 },
    ];
    const deals = [];
    for (let i = 0; i < dealsData.length; i++) {
      const dealData = dealsData[i];
      const owner = users[i % users.length];
      const stage = stages[dealData.stageIndex % stages.length];
      deals.push(
        await ensureDeal({
          title: dealData.title,
          amount: dealData.amount,
          stageId: stage.id,
          pipelineId: pipeline.id,
          contactId: contacts[dealData.contactIndex]?.id,
          companyId: dealData.companyIndex !== undefined ? companies[dealData.companyIndex].id : undefined,
          ownerUserId: owner.id,
          expectedCloseDate: new Date(now.getTime() + (i + 3) * 24 * 60 * 60 * 1000),
        })
      );
    }

    const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST'];
    for (let i = 0; i < 30; i++) {
      const status = leadStatuses[i % leadStatuses.length];
      await ensureLead({
        firstName: `لید`,
        lastName: `${DEMO_PREFIX}${i + 1}`,
        phone: `0912300${String(100 + i)}`,
        email: `demo.lead.${i + 1}@example.com`,
        companyName: i % 2 === 0 ? companies[i % companies.length].name : undefined,
        source: i % 3 === 0 ? 'سایت' : i % 3 === 1 ? 'تبلیغ' : 'تماس',
        status,
        notes: `سرنخ دمو شماره ${i + 1}`,
        followUpAt: i % 2 === 0 ? new Date(now.getTime() + (i + 1) * 36 * 60 * 60 * 1000) : undefined,
        ownerUserId: users[i % users.length].id,
      });
    }

    for (let i = 0; i < 20; i++) {
      const dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + (i % 7));
      await ensureTask({
        title: `${DEMO_PREFIX}وظیفه پیگیری ${i + 1}`,
        dueAt,
        status: i % 3 === 0 ? 'DONE' : 'OPEN',
        assignedToUserId: users[i % users.length].id,
        contactId: contacts[i % contacts.length]?.id,
        dealId: i % 2 === 0 ? deals[i % deals.length]?.id : undefined,
      });
    }

    const activityTypes = ['CALL', 'MEETING', 'NOTE'];
    for (let i = 0; i < 25; i++) {
      await ensureActivity({
        type: activityTypes[i % activityTypes.length],
        body: `${DEMO_PREFIX}فعالیت ${i + 1} برای دمو`,
        happenedAt: new Date(now.getTime() - (i + 1) * 12 * 60 * 60 * 1000),
        createdByUserId: users[i % users.length].id,
        contactId: contacts[i % contacts.length]?.id,
        dealId: i % 2 === 0 ? deals[i % deals.length]?.id : undefined,
      });
    }
  });

  console.log('Seed OK: tenant demo, demo-owner / 12345678, دیتای دمو کامل');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
