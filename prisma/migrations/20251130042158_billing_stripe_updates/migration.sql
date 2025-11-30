/*
  Warnings:

  - You are about to drop the column `stripe_customer_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_status` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[business_id,plan_id]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "stripe_customer_id" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "stripe_price_id" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "stripe_customer_id",
DROP COLUMN "subscription_id",
DROP COLUMN "subscription_status";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_business_id_plan_id_key" ON "Subscription"("business_id", "plan_id");
