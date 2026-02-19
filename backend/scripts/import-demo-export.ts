import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_FILE = "prisma/my-hardcode.json";

type ExportRow = Record<string, any>;
type ExportShape = {
  exportedAt: string;
  options: { tenantSlug: string | null; includeSessions: boolean };
  tables: Record<string, ExportRow[] | undefined>;
};

function ensureGuard() {
  if (process.env.ALLOW_PROD_IMPORT !== "true") {
    throw new Error(
      "Refusing to run. Set ALLOW_PROD_IMPORT=true to proceed (production guard).",
    );
  }
}

function resolveImportFile(): string {
  const raw = process.argv[2]?.trim();
  const target = raw && raw.length > 0 ? raw : DEFAULT_FILE;
  return path.resolve(target);
}

function readExportFile(filePath: string): ExportShape {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Import file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ExportShape;
}

function rows(data: ExportShape, key: string): ExportRow[] {
  const value = data.tables?.[key];
  return Array.isArray(value) ? value : [];
}

async function createRows(
  label: string,
  items: ExportRow[],
  creator: (row: ExportRow) => Promise<unknown>,
) {
  if (items.length === 0) {
    return;
  }

  console.log(`Creating ${label} (${items.length})...`);
  for (const item of items) {
    await creator(item);
  }
}

async function purgeExistingTenant(tenantId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.activity.deleteMany({ where: { tenantId } });
    await tx.task.deleteMany({ where: { tenantId } });
    await tx.deal.deleteMany({ where: { tenantId } });
    await tx.lead.deleteMany({ where: { tenantId } });
    await tx.contact.deleteMany({ where: { tenantId } });
    await tx.company.deleteMany({ where: { tenantId } });
    await tx.pipelineStage.deleteMany({ where: { tenantId } });
    await tx.pipeline.deleteMany({ where: { tenantId } });
    await tx.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
    await tx.invoice.deleteMany({ where: { tenantId } });
    await tx.subscription.deleteMany({ where: { tenantId } });
    await tx.session.deleteMany({ where: { tenantId } });
    await tx.membership.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
}

async function main() {
  ensureGuard();

  const importFile = resolveImportFile();
  const data = readExportFile(importFile);
  const tenantRows = rows(data, "tenant");
  const tenantRow = tenantRows[0];

  if (!tenantRow?.slug) {
    throw new Error("No tenant row found in export.");
  }

  const tenantSlug = String(tenantRow.slug);
  console.log(`Import file: ${importFile}`);
  console.log(`Importing tenant slug: ${tenantSlug}`);

  const existing = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (existing) {
    console.log(`Existing tenant found. Purging tenantId=${existing.id} ...`);
    await purgeExistingTenant(existing.id);
    console.log("Old tenant removed.");
  }

  console.log("Creating tenant...");
  await prisma.tenant.create({ data: tenantRow as any });

  const users = rows(data, "user");
  if (users.length > 0) {
    console.log(`Upserting users (${users.length})...`);
    for (const user of users) {
      const id = user.id;
      if (!id) {
        throw new Error("User row is missing id.");
      }

      const { id: _id, ...rest } = user;
      await prisma.user.upsert({
        where: { id: String(id) },
        create: user as any,
        update: rest as any,
      });
    }
  }

  await createRows("memberships", rows(data, "membership"), (row) =>
    prisma.membership.create({ data: row as any }),
  );
  await createRows("sessions", rows(data, "session"), (row) =>
    prisma.session.create({ data: row as any }),
  );
  await createRows("subscriptions", rows(data, "subscription"), (row) =>
    prisma.subscription.create({ data: row as any }),
  );
  await createRows("invoices", rows(data, "invoice"), (row) =>
    prisma.invoice.create({ data: row as any }),
  );
  await createRows("invoice items", rows(data, "invoiceItem"), (row) =>
    prisma.invoiceItem.create({ data: row as any }),
  );
  await createRows("pipelines", rows(data, "pipeline"), (row) =>
    prisma.pipeline.create({ data: row as any }),
  );
  await createRows("pipeline stages", rows(data, "pipelineStage"), (row) =>
    prisma.pipelineStage.create({ data: row as any }),
  );
  await createRows("companies", rows(data, "company"), (row) =>
    prisma.company.create({ data: row as any }),
  );
  await createRows("contacts", rows(data, "contact"), (row) =>
    prisma.contact.create({ data: row as any }),
  );
  await createRows("leads", rows(data, "lead"), (row) =>
    prisma.lead.create({ data: row as any }),
  );
  await createRows("deals", rows(data, "deal"), (row) =>
    prisma.deal.create({ data: row as any }),
  );
  await createRows("tasks", rows(data, "task"), (row) =>
    prisma.task.create({ data: row as any }),
  );
  await createRows("activities", rows(data, "activity"), (row) =>
    prisma.activity.create({ data: row as any }),
  );
  await createRows("audit logs", rows(data, "auditLog"), (row) =>
    prisma.auditLog.create({ data: row as any }),
  );

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
