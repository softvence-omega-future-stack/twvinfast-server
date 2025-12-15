/*
  Warnings:

  - You are about to drop the column `imap_port` on the `Mailbox` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Mailbox" DROP COLUMN "imap_port",
ADD COLUMN     "imapstates_port" INTEGER;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "EmailThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
