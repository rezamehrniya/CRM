-- AlterTable
ALTER TABLE "User" ADD COLUMN "ext" TEXT;

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'IN_PROGRESS', 'ANSWERED', 'MISSED', 'FAILED', 'ENDED');

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "answeredByUserId" TEXT,
    "status" "CallStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "ext" TEXT NOT NULL,
    "recordingUrl" TEXT,
    "providerCallId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallLog_tenantId_startedAt_idx" ON "CallLog"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_agentUserId_startedAt_idx" ON "CallLog"("tenantId", "agentUserId", "startedAt");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_status_startedAt_idx" ON "CallLog"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_tenantId_providerCallId_key" ON "CallLog"("tenantId", "providerCallId");

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
