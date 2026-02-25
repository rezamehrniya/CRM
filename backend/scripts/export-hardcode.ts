import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const prisma = new PrismaClient();

type Args = {
  tenantSlug?: string;
  includeSessions: boolean;
  outFile: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    includeSessions: false,
    outFile: 'prisma/crm-hardcode-data.json',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tenant' && argv[i + 1]) {
      args.tenantSlug = argv[i + 1];
      i++;
      continue;
    }
    if (arg === '--include-sessions') {
      args.includeSessions = true;
      continue;
    }
    if (arg === '--out' && argv[i + 1]) {
      args.outFile = argv[i + 1];
      i++;
      continue;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const whereTenant = args.tenantSlug
    ? { slug: args.tenantSlug }
    : undefined;

  const tenants = await prisma.tenant.findMany({
    where: whereTenant,
    orderBy: { createdAt: 'asc' },
  });

  if (tenants.length === 0) {
    throw new Error(
      args.tenantSlug
        ? `No tenant found for slug: ${args.tenantSlug}`
        : 'No tenant found',
    );
  }

  const tenantIds = tenants.map((t) => t.id);

  const memberships = await prisma.membership.findMany({
    where: { tenantId: { in: tenantIds } },
    orderBy: { id: 'asc' },
  });
  const roles = await prisma.role.findMany({
    where: { tenantId: { in: tenantIds } },
    orderBy: [{ tenantId: 'asc' }, { key: 'asc' }],
  });
  const roleIds = roles.map((role) => role.id);
  const rolePermissions = roleIds.length
    ? await prisma.rolePermission.findMany({
        where: { roleId: { in: roleIds } },
        orderBy: [{ roleId: 'asc' }, { permissionId: 'asc' }],
      })
    : [];
  const permissionIds = Array.from(new Set(rolePermissions.map((entry) => entry.permissionId)));
  const permissions = permissionIds.length
    ? await prisma.permission.findMany({
        where: { id: { in: permissionIds } },
        orderBy: { key: 'asc' },
      })
    : [];
  const userIds = Array.from(new Set(memberships.map((m) => m.userId)));

  const data = {
    exportedAt: new Date().toISOString(),
    options: {
      tenantSlug: args.tenantSlug ?? null,
      includeSessions: args.includeSessions,
    },
    tables: {
      tenant: tenants,
      role: roles,
      permission: permissions,
      rolePermission: rolePermissions,
      user: await prisma.user.findMany({
        where: { id: { in: userIds } },
        orderBy: { createdAt: 'asc' },
      }),
      membership: memberships,
      session: args.includeSessions
        ? await prisma.session.findMany({
            where: { tenantId: { in: tenantIds } },
            orderBy: { createdAt: 'asc' },
          })
        : [],
      subscription: await prisma.subscription.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { startsAt: 'asc' },
      }),
      invoice: await prisma.invoice.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { id: 'asc' },
      }),
      invoiceItem: await prisma.invoiceItem.findMany({
        where: {
          invoice: {
            tenantId: { in: tenantIds },
          },
        },
        orderBy: { id: 'asc' },
      }),
      pipeline: await prisma.pipeline.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { id: 'asc' },
      }),
      pipelineStage: await prisma.pipelineStage.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: [{ pipelineId: 'asc' }, { order: 'asc' }],
      }),
      company: await prisma.company.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { id: 'asc' },
      }),
      contact: await prisma.contact.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { id: 'asc' },
      }),
      lead: await prisma.lead.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'asc' },
      }),
      deal: await prisma.deal.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { id: 'asc' },
      }),
      dealItem: await prisma.dealItem.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: [{ dealId: 'asc' }, { position: 'asc' }, { id: 'asc' }],
      }),
      task: await prisma.task.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { id: 'asc' },
      }),
      activity: await prisma.activity.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { happenedAt: 'asc' },
      }),
      auditLog: await prisma.auditLog.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'asc' },
      }),
    },
  };

  const outPath = join(process.cwd(), args.outFile);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      data,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
    'utf8',
  );

  const counts = Object.fromEntries(
    Object.entries(data.tables).map(([table, rows]) => [table, rows.length]),
  );

  console.log('Export OK:', outPath);
  console.log('Counts:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
