/*
  Warnings:

  - You are about to drop the column `created_at` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `is_starred` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `received_at` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `sent_at` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Email` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "created_at",
DROP COLUMN "is_starred",
DROP COLUMN "received_at",
DROP COLUMN "sent_at",
DROP COLUMN "updated_at",
ADD COLUMN     "direction" "EmailDirection",
ADD COLUMN     "message_id" TEXT,
ADD COLUMN     "references" TEXT;

-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN     "last_message_id" TEXT,
ADD COLUMN     "references" TEXT;
