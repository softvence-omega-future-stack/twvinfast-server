-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('TEXT', 'FILE', 'FAQ');

-- CreateEnum
CREATE TYPE "HallucinationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "HallucinationStatus" AS ENUM ('OPEN', 'FIXED', 'DISMISSED');

-- CreateTable
CREATE TABLE "AiGeneratedReply" (
    "id" SERIAL NOT NULL,
    "email_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "business_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tone" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT DEFAULT 'SUGGESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneratedReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTrainingData" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "type" "TrainingType" NOT NULL,
    "content" TEXT,
    "file_url" TEXT,
    "tags" JSONB,
    "approved_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTrainingData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiHallucinationReport" (
    "id" SERIAL NOT NULL,
    "email_id" INTEGER NOT NULL,
    "reply_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "business_id" INTEGER NOT NULL,
    "issue_type" TEXT NOT NULL,
    "comment" TEXT,
    "severity" "HallucinationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "HallucinationStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixed_at" TIMESTAMP(3),

    CONSTRAINT "AiHallucinationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelSettings" (
    "id" SERIAL NOT NULL,
    "model_name" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "max_tokens" INTEGER DEFAULT 2048,
    "system_prompt" TEXT,
    "safety_rules" JSONB,
    "fallback_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "email_limit" INTEGER,
    "ai_credits" INTEGER,
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "renewal_date" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHistory" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "subscription_id" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "invoice_url" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AiGeneratedReply" ADD CONSTRAINT "AiGeneratedReply_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneratedReply" ADD CONSTRAINT "AiGeneratedReply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneratedReply" ADD CONSTRAINT "AiGeneratedReply_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTrainingData" ADD CONSTRAINT "AiTrainingData_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHallucinationReport" ADD CONSTRAINT "AiHallucinationReport_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHallucinationReport" ADD CONSTRAINT "AiHallucinationReport_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "AiGeneratedReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHallucinationReport" ADD CONSTRAINT "AiHallucinationReport_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHallucinationReport" ADD CONSTRAINT "AiHallucinationReport_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
