/*
  Warnings:

  - A unique constraint covering the columns `[business_id,email]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "company" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "preferred_language" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_business_id_idx" ON "Customer"("business_id");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_business_id_email_key" ON "Customer"("business_id", "email");
