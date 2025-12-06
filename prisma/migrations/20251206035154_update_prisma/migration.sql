/*
  Warnings:

  - Made the column `subject` on table `EmailThread` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_message_at` on table `EmailThread` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updated_at` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_mailbox_id_fkey";

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_thread_id_fkey";

-- DropForeignKey
ALTER TABLE "EmailThread" DROP CONSTRAINT "EmailThread_mailbox_id_fkey";

-- AlterTable
ALTER TABLE "Email" ALTER COLUMN "thread_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "subject" SET NOT NULL,
ALTER COLUMN "last_message_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Subscription_business_id_idx" ON "Subscription"("business_id");

-- CreateIndex
CREATE INDEX "Subscription_plan_id_idx" ON "Subscription"("plan_id");
