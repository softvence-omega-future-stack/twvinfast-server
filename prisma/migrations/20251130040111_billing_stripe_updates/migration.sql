-- AlterTable
ALTER TABLE "PaymentHistory" ADD COLUMN     "stripe_invoice_id" TEXT,
ADD COLUMN     "stripe_payment_intent_id" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT;
