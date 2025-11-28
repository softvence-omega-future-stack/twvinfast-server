/*
  Warnings:

  - The values [GOOGLE_DRIVE,TRELLO,GOOGLE_CALENDAR,OUTLOOK_CALENDAR,ICAL,SLACK,SMS] on the enum `IntegrationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `input_snapshot` on the `AIAction` table. All the data in the column will be lost.
  - You are about to drop the column `output_data` on the `AIAction` table. All the data in the column will be lost.
  - You are about to drop the column `contact_email` on the `AIEmailInsight` table. All the data in the column will be lost.
  - You are about to drop the column `lead_score` on the `AIEmailInsight` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `AIEmailInsight` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Business` table. All the data in the column will be lost.
  - You are about to drop the column `primary_contact_email` on the `Business` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Integration` table. All the data in the column will be lost.
  - You are about to drop the column `access_token` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `connected_at` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `last_sync_at` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `close_date` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `won_lost_reason` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `AIModel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AITrainingAuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ActivityLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BusinessCredits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BusinessNotificationRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BusinessSettings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BusinessSubscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ComplianceSettings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Dataset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailAttachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailLabel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Label` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LoginLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ModelPrompt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlatformApiKey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlatformSecuritySettings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RolePermissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SystemPrompt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrainingDocument` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "IntegrationType_new" AS ENUM ('GOOGLE', 'OUTLOOK', 'SMTP', 'OTHER');
ALTER TABLE "Integration" ALTER COLUMN "type" TYPE "IntegrationType_new" USING ("type"::text::"IntegrationType_new");
ALTER TYPE "IntegrationType" RENAME TO "IntegrationType_old";
ALTER TYPE "IntegrationType_new" RENAME TO "IntegrationType";
DROP TYPE "public"."IntegrationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "BusinessCredits" DROP CONSTRAINT "BusinessCredits_business_id_fkey";

-- DropForeignKey
ALTER TABLE "BusinessSettings" DROP CONSTRAINT "BusinessSettings_business_id_fkey";

-- DropForeignKey
ALTER TABLE "BusinessSubscription" DROP CONSTRAINT "BusinessSubscription_business_id_fkey";

-- DropForeignKey
ALTER TABLE "BusinessSubscription" DROP CONSTRAINT "BusinessSubscription_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "RolePermissions" DROP CONSTRAINT "RolePermissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "RolePermissions" DROP CONSTRAINT "RolePermissions_role_id_fkey";

-- AlterTable
ALTER TABLE "AIAction" DROP COLUMN "input_snapshot",
DROP COLUMN "output_data";

-- AlterTable
ALTER TABLE "AIEmailInsight" DROP COLUMN "contact_email",
DROP COLUMN "lead_score",
DROP COLUMN "meta_json";

-- AlterTable
ALTER TABLE "Business" DROP COLUMN "address",
DROP COLUMN "primary_contact_email",
ADD COLUMN     "email" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Email" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Integration" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Mailbox" DROP COLUMN "access_token",
DROP COLUMN "connected_at",
DROP COLUMN "last_sync_at",
DROP COLUMN "refresh_token",
DROP COLUMN "status",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "is_ssl" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "close_date",
DROP COLUMN "won_lost_reason";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "scope";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "AIModel";

-- DropTable
DROP TABLE "AITrainingAuditLog";

-- DropTable
DROP TABLE "ActivityLog";

-- DropTable
DROP TABLE "BusinessCredits";

-- DropTable
DROP TABLE "BusinessNotificationRule";

-- DropTable
DROP TABLE "BusinessSettings";

-- DropTable
DROP TABLE "BusinessSubscription";

-- DropTable
DROP TABLE "ComplianceSettings";

-- DropTable
DROP TABLE "Dataset";

-- DropTable
DROP TABLE "EmailAttachment";

-- DropTable
DROP TABLE "EmailLabel";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "Label";

-- DropTable
DROP TABLE "LoginLog";

-- DropTable
DROP TABLE "ModelPrompt";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "PlatformApiKey";

-- DropTable
DROP TABLE "PlatformSecuritySettings";

-- DropTable
DROP TABLE "RolePermissions";

-- DropTable
DROP TABLE "SubscriptionPlan";

-- DropTable
DROP TABLE "SystemPrompt";

-- DropTable
DROP TABLE "TrainingDocument";

-- DropEnum
DROP TYPE "BillingCycle";

-- DropEnum
DROP TYPE "Scope";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "Mailbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "Mailbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "EmailThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIEmailInsight" ADD CONSTRAINT "AIEmailInsight_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
