/* scripts/import-demo-export.ts */
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ExportShape = {
  exportedAt: string;
  options: { tenantSlug: string | null; includeSessions: boolean };
  tables: Record<string, any[]>;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  // گارد ضد اشتباه روی پرود
  if (process.env.ALLOW_PROD_IMPORT !== "true") {
    throw new Error(
      "Refusing to run. Set ALLOW_PROD_IMPORT=true to proceed (production guard)."
    );
  }

  const file = process.argv[2];
  if (!file) throw new Error("Usage: ts-node scripts/import-demo-export.ts /path/to/demo-export.json");

  const raw = fs.readFileSync(path.resolve(file), "utf-8");
  const data = JSON.parse(raw) as ExportShape;

  const t = data.tables;

  const tenantRow = (t.tenant?.[0] ?? null) as any;
  if (!tenantRow?.slug) throw new Error("No tenant row found in export.");

  const demoSlug = tenantRow.slug as string;

  console.log("Importing tenant slug:", demoSlug);

  // 1) اگر demo وجود دارد، پاکسازی کامل tenant demo
  const existing = await prisma.tenant.findUnique({ where: { slug: demoSlug } });

  if (existing) {
    console.log("Existing demo tenant found. Purging dependent data... tenantId=", existing.id);

    // ترتیب حذف مهم است (FK)
    // اگر اسم مدل‌ها در Prisma شما متفاوت است، همین ترتیب را با اسم درست مدل‌ها جایگزین کن.
    await prisma.$transaction(async (tx) => {
      // child tables -> parent
      if ((tx as any).auditLog) await (tx as any).auditLog.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).activity) await (tx as any).activity.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).task) await (tx as any).task.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).deal) await (tx as any).deal.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).lead) await (tx as any).lead.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).contact) await (tx as any).contact.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).company) await (tx as any).company.deleteMany({ where: { tenantId: existing.id } });

      if ((tx as any).pipelineStage) await (tx as any).pipelineStage.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).pipeline) await (tx as any).pipeline.deleteMany({ where: { tenantId: existing.id } });

      if ((tx as any).invoiceItem) await (tx as any).invoiceItem.deleteMany({ where: { invoice: { tenantId: existing.id } } });
if ((tx as any).invoiceItem)
  await (tx as any).invoiceItem.deleteMany({
    where: { invoice: { tenantId: existing.id } },
  });

      if ((tx as any).subscription) await (tx as any).subscription.deleteMany({ where: { tenantId: existing.id } });
      if ((tx as any).session) await (tx as any).session.deleteMany({ where: { tenantId: existing.id } });

      if ((tx as any).membership) await (tx as any).membership.deleteMany({ where: { tenantId: existing.id } });

      // نکته: userها ممکن است tenant دیگری هم داشته باشند (اگر multi-tenant user دارید).
      // اینجا فقط userهایی را حذف می‌کنیم که فقط عضو همین tenant هستند.
      // اگر ساختار شما ساده است، می‌توانی کل userهای export را delete کنی.
    });

    // در نهایت tenant را پاک کن تا بتوانیم با ID اصلی export دوباره بسازیم
    await prisma.tenant.delete({ where: { id: existing.id } });
    console.log("Old demo tenant deleted.");
  }

  // 2) ساخت tenant دقیقاً با همان ID export
  console.log("Creating tenant...");
  await prisma.tenant.create({ data: tenantRow });

  // 3) Import user
  console.log("Creating users...");
  for (const u of t.user ?? []) {
    await prisma.user.create({ data: u });
  }

  // 4) membership
  console.log("Creating memberships...");
  for (const m of t.membership ?? []) {
    await prisma.membership.create({ data: m });
  }

  // 5) sessions (در export شما خالیه ولی گذاشتم)
  console.log("Creating sessions...");
  for (const s of t.session ?? []) {
    await (prisma as any).session.create({ data: s });
  }

  // 6) subscription
  console.log("Creating subscriptions...");
  for (const s of t.subscription ?? []) {
    await (prisma as any).subscription.create({ data: s });
  }

  // 7) pipeline & stages
  console.log("Creating pipelines...");
  for (const p of t.pipeline ?? []) {
    await (prisma as any).pipeline.create({ data: p });
  }

  console.log("Creating pipeline stages...");
  for (const ps of t.pipelineStage ?? []) {
    await (prisma as any).pipelineStage.create({ data: ps });
  }

  // 8) company
  console.log("Creating companies...");
  for (const c of t.company ?? []) {
    await (prisma as any).company.create({ data: c });
  }

  // 9) contact
  console.log("Creating contacts...");
  for (const c of t.contact ?? []) {
    await (prisma as any).contact.create({ data: c });
  }

  // 10) lead
  console.log("Creating leads...");
  for (const l of t.lead ?? []) {
    await (prisma as any).lead.create({ data: l });
  }

  // 11) deal
  console.log("Creating deals...");
  for (const d of t.deal ?? []) {
    await (prisma as any).deal.create({ data: d });
  }

  // 12) task
  console.log("Creating tasks...");
  for (const task of t.task ?? []) {
    await (prisma as any).task.create({ data: task });
  }

  // 13) activity
  console.log("Creating activities...");
  for (const a of t.activity ?? []) {
    await (prisma as any).activity.create({ data: a });
  }

  // auditLog خالی
  console.log("Done ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
