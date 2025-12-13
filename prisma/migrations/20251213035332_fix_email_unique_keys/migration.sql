/*
  Warnings:

  - You are about to drop the column `message_id` on the `Email` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[mailbox_id,imap_uid]` on the table `Email` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Email_message_id_key";

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "message_id";

-- CreateIndex
CREATE UNIQUE INDEX "Email_mailbox_id_imap_uid_key" ON "Email"("mailbox_id", "imap_uid");
