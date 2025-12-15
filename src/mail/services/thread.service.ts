import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ThreadService {
  constructor(private prisma: PrismaService) {}

  /* ===============================
     THREAD LIST (INBOX)
  =============================== */

  async getThreadsByMailbox(mailbox_id: number) {
    return this.prisma.emailThread.findMany({
      where: {
        mailbox_id,
        is_archived: false,
      },
      orderBy: {
        last_message_at: 'desc',
      },
      include: {
        customer: true, // 🔥 Inbox UI needs name/email
      },
    });
  }

  /* ===============================
     SINGLE THREAD + EMAILS
  =============================== */

  async getThreadWithEmails(thread_id: number) {
    const thread = await this.prisma.emailThread.findUnique({
      where: { id: thread_id },
      include: {
        customer: true,
        // 🔥 full conversation
        // assumes relation is enabled
        emails: {
          orderBy: [{ received_at: 'desc' }, { sent_at: 'desc' }],
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return thread;
  }

  /* ===============================
     ARCHIVE / UNARCHIVE
  =============================== */

  archiveThread(id: number) {
    return this.prisma.emailThread.update({
      where: { id },
      data: { is_archived: true },
    });
  }

  unarchiveThread(id: number) {
    return this.prisma.emailThread.update({
      where: { id },
      data: { is_archived: false },
    });
  }

  /* ===============================
     READ / UNREAD (ALL EMAILS)
  =============================== */

  async markThreadRead(thread_id: number) {
    await this.prisma.email.updateMany({
      where: {
        thread_id,
        is_read: false,
      },
      data: { is_read: true },
    });

    return { success: true };
  }

  async markThreadUnread(thread_id: number) {
    await this.prisma.email.updateMany({
      where: {
        thread_id,
      },
      data: { is_read: false },
    });

    return { success: true };
  }
}
