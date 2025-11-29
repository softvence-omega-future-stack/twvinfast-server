/*
  Warnings:

  - You are about to drop the column `customer_id` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "customer_id",
ADD COLUMN     "stripe_customer_id" TEXT;
