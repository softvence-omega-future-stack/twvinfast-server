/*
  Warnings:

  - You are about to drop the column `companyId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailSignature` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastLogin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `timeZone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twoFA` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - The `status` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Company` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `password_hash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'TRIALING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "EmailFolder" AS ENUM ('INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "AIActionType" AS ENUM ('SUMMARY', 'REPLY_DRAFT', 'SENTIMENT', 'CLASSIFICATION', 'FOLLOWUP_SUGGESTION');

-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('PLATFORM', 'BUSINESS');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GOOGLE_DRIVE', 'TRELLO', 'GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'ICAL', 'SLACK', 'SMS');

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "companyId",
DROP COLUMN "createdAt",
DROP COLUMN "emailSignature",
DROP COLUMN "lastLogin",
DROP COLUMN "location",
DROP COLUMN "password",
DROP COLUMN "phone",
DROP COLUMN "role",
DROP COLUMN "timeZone",
DROP COLUMN "twoFA",
DROP COLUMN "updatedAt",
ADD COLUMN     "business_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "password_hash" TEXT NOT NULL,
ADD COLUMN     "role_id" INTEGER NOT NULL,
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT;

-- DropTable
DROP TABLE "Company";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "Status";

-- CreateTable
CREATE TABLE "Business" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "address" TEXT,
    "primary_contact_email" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSubscription" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),

    CONSTRAINT "BusinessSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "features_json" JSONB,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "business_subscription_id" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCredits" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "total_credits" INTEGER,
    "used_credits" INTEGER,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),

    CONSTRAINT "BusinessCredits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "primary_colour" TEXT,
    "secondary_colour" TEXT,
    "accent_colour" TEXT,
    "logo_url" TEXT,
    "timezone" TEXT,
    "show_logo_in_sidebar" BOOLEAN DEFAULT false,
    "compact_mode" BOOLEAN DEFAULT false,
    "show_performance_metrics" BOOLEAN DEFAULT true,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "RolePermissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "ip_address" TEXT,
    "status" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" INTEGER,
    "description" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mailbox" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "email_address" TEXT NOT NULL,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "is_ssl" BOOLEAN,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "connected_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "mailbox_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "subject" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "mailbox_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message_id" TEXT,
    "in_reply_to" TEXT,
    "from_address" TEXT,
    "to_addresses" JSONB,
    "cc_addresses" JSONB,
    "bcc_addresses" JSONB,
    "subject" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "folder" "EmailFolder",
    "is_read" BOOLEAN DEFAULT false,
    "is_starred" BOOLEAN DEFAULT false,
    "received_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAttachment" (
    "id" SERIAL NOT NULL,
    "email_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "storage_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT,
    "description" TEXT,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLabel" (
    "email_id" INTEGER NOT NULL,
    "label_id" INTEGER NOT NULL,

    CONSTRAINT "EmailLabel_pkey" PRIMARY KEY ("email_id","label_id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT,
    "lead_score" INTEGER,
    "value_estimate" DOUBLE PRECISION,
    "last_contact_at" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL,
    "value_amount" DOUBLE PRECISION,
    "status" TEXT,
    "won_lost_reason" TEXT,
    "close_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIEmailInsight" (
    "id" SERIAL NOT NULL,
    "email_id" INTEGER NOT NULL,
    "summary" TEXT,
    "suggested_actions" TEXT,
    "lead_score" INTEGER,
    "contact_email" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEmailInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAction" (
    "id" SERIAL NOT NULL,
    "email_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "action_type" "AIActionType" NOT NULL,
    "input_snapshot" JSONB,
    "output_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "size_gb" DOUBLE PRECISION,
    "record_count" INTEGER,
    "status" TEXT,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDocument" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "dataset_id" INTEGER,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER,
    "storage_url" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITrainingAuditLog" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "dataset_id" INTEGER,
    "training_document_id" INTEGER,
    "admin_user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "data_type" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT,

    CONSTRAINT "AITrainingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT,
    "usage_percent" DOUBLE PRECISION,
    "uptime_percent" DOUBLE PRECISION,
    "avg_response_time" DOUBLE PRECISION,
    "overall_accuracy" DOUBLE PRECISION,
    "cost_per_1k" DOUBLE PRECISION,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt_content" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "status" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPrompt" (
    "model_id" INTEGER NOT NULL,
    "prompt_id" INTEGER NOT NULL,

    CONSTRAINT "ModelPrompt_pkey" PRIMARY KEY ("model_id","prompt_id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" TEXT,
    "config_json" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessNotificationRule" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "rule_name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_condition_json" JSONB,
    "action_type" TEXT NOT NULL,
    "action_config_json" JSONB,
    "status" TEXT,

    CONSTRAINT "BusinessNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformApiKey" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER,
    "name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "permissions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "PlatformApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSecuritySettings" (
    "id" SERIAL NOT NULL,
    "enforce_https" BOOLEAN DEFAULT true,
    "rate_limit_per_minute" INTEGER,
    "ddos_protection_enabled" BOOLEAN DEFAULT true,
    "waf_enabled" BOOLEAN DEFAULT true,

    CONSTRAINT "PlatformSecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceSettings" (
    "id" SERIAL NOT NULL,
    "gdpr_enabled" BOOLEAN DEFAULT true,
    "ccpa_enabled" BOOLEAN DEFAULT false,
    "hipaa_enabled" BOOLEAN DEFAULT false,
    "sox_enabled" BOOLEAN DEFAULT false,
    "privacy_policy_url" TEXT,
    "terms_of_service_url" TEXT,
    "data_retention_period_days" INTEGER,

    CONSTRAINT "ComplianceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCredits_business_id_key" ON "BusinessCredits"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_business_id_key" ON "BusinessSettings"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "AIEmailInsight_email_id_key" ON "AIEmailInsight"("email_id");

-- AddForeignKey
ALTER TABLE "BusinessSubscription" ADD CONSTRAINT "BusinessSubscription_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSubscription" ADD CONSTRAINT "BusinessSubscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCredits" ADD CONSTRAINT "BusinessCredits_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
