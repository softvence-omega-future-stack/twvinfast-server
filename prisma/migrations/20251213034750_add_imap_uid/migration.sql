/*
  Warnings:

  - A unique constraint covering the columns `[message_id]` on the table `Email` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "imap_uid" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Email_message_id_key" ON "Email"("message_id");
