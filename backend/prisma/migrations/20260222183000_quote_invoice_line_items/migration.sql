-- AlterTable
ALTER TABLE "Deal"
ADD COLUMN "subtotal" DECIMAL(18,0),
ADD COLUMN "discountAmount" DECIMAL(18,0),
ADD COLUMN "taxAmount" DECIMAL(18,0);

-- CreateTable
CREATE TABLE "DealItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "productCode" TEXT,
    "productName" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,0) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,0) NOT NULL,
    "lineDiscountAmount" DECIMAL(18,0) NOT NULL,
    "lineTaxAmount" DECIMAL(18,0) NOT NULL,
    "lineTotal" DECIMAL(18,0) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealItem_tenantId_dealId_position_idx" ON "DealItem"("tenantId", "dealId", "position");

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
