-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email_signature" TEXT,
ADD COLUMN     "phone" INTEGER,
ADD COLUMN     "timezone" TEXT DEFAULT 'UTC';
