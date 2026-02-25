-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOptOut" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "senderLine" TEXT NOT NULL DEFAULT 'Sakhtar',
    "recipientPhone" TEXT NOT NULL,
    "recipientName" TEXT,
    "body" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "source" TEXT NOT NULL DEFAULT 'SINGLE',
    "campaignKey" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "errorMessage" TEXT,
    "templateId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsTemplate_tenantId_isActive_updatedAt_idx" ON "SmsTemplate"("tenantId", "isActive", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_tenantId_name_key" ON "SmsTemplate"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOptOut_tenantId_phone_key" ON "SmsOptOut"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "SmsOptOut_tenantId_createdAt_idx" ON "SmsOptOut"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_tenantId_queuedAt_idx" ON "SmsLog"("tenantId", "queuedAt");

-- CreateIndex
CREATE INDEX "SmsLog_tenantId_createdByUserId_queuedAt_idx" ON "SmsLog"("tenantId", "createdByUserId", "queuedAt");

-- CreateIndex
CREATE INDEX "SmsLog_tenantId_status_queuedAt_idx" ON "SmsLog"("tenantId", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "SmsLog_tenantId_campaignKey_idx" ON "SmsLog"("tenantId", "campaignKey");

-- CreateIndex
CREATE UNIQUE INDEX "SmsLog_tenantId_providerMessageId_key" ON "SmsLog"("tenantId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "SmsTemplate" ADD CONSTRAINT "SmsTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsTemplate" ADD CONSTRAINT "SmsTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsOptOut" ADD CONSTRAINT "SmsOptOut_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsOptOut" ADD CONSTRAINT "SmsOptOut_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SmsTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
