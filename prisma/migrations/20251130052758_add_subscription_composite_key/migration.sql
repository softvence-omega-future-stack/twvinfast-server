-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'usd',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "interval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "stripe_product_id" TEXT;
