-- AlterTable
ALTER TABLE "Task"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Normalize legacy statuses
UPDATE "Task" SET "status" = 'today' WHERE "status" = 'OPEN';
UPDATE "Task" SET "status" = 'done' WHERE "status" = 'DONE';

-- Set new default status
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'today';

-- Rebuild position from existing data
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "status"
      ORDER BY COALESCE("dueAt", CURRENT_TIMESTAMP), "id"
    ) - 1 AS pos
  FROM "Task"
)
UPDATE "Task" t
SET "position" = ranked.pos
FROM ranked
WHERE ranked."id" = t."id";

-- CreateIndex
CREATE INDEX "Task_tenantId_status_position_idx" ON "Task"("tenantId", "status", "position");

-- CreateIndex
CREATE INDEX "Task_tenantId_assignedToUserId_status_position_idx" ON "Task"("tenantId", "assignedToUserId", "status", "position");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
