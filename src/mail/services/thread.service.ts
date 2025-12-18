import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ThreadStatus, Prisma } from '@prisma/client';

@Injectable()
export class ThreadService {
  constructor(private prisma: PrismaService) {}

  /* ===============================
     THREAD LIST
  =============================== */
  async getThreadsByMailbox(params: {
    mailbox_id: number;
    folder?: string;
    search?: string;
    status?: ThreadStatus;
    tag?: number; // label_id
    sort?: 'newest' | 'oldest';
    page?: number;
    limit?: number;
  }) {
    const {
      mailbox_id,
      folder = 'inbox',
      search,
      status,
      tag,
      sort = 'newest',
      page = 1,
      limit = 6,
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.EmailThreadWhereInput = {
      mailbox_id,
    };

    /* ---------- Folder Logic ---------- */
    switch (folder) {
      case 'starred':
        where.is_starred = true;
        where.is_deleted = false;
        break;
      case 'archived':
        where.is_archived = true;
        where.is_deleted = false;
        break;
      case 'trash':
        where.is_deleted = true;
        break;
      case 'unread':
        where.status = ThreadStatus.NEW;
        where.is_deleted = false;
        break;
      default:
        where.is_archived = false;
        where.is_deleted = false;
    }

    /* ---------- Search ---------- */
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    /* ---------- Status ---------- */
    if (status) {
      where.status = status;
    }

    /* ---------- Label Filter (PIVOT) ---------- */
    if (tag) {
      console.log(tag);
      where.labels = {
        some: {
          label_id: tag, 
        },
      };
    }

    const total = await this.prisma.emailThread.count({ where });

    const data = await this.prisma.emailThread.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        last_message_at: sort === 'oldest' ? 'asc' : 'desc',
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        customer: true,
      },
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /* ===============================
     COUNTS
  =============================== */
  async getThreadCounts(mailbox_id: number) {
    const base = { mailbox_id };

    const [inbox, starred, archived, trash, unread] = await Promise.all([
      this.prisma.emailThread.count({
        where: { ...base, is_deleted: false, is_archived: false },
      }),
      this.prisma.emailThread.count({
        where: { ...base, is_starred: true, is_deleted: false },
      }),
      this.prisma.emailThread.count({
        where: { ...base, is_archived: true, is_deleted: false },
      }),
      this.prisma.emailThread.count({
        where: { ...base, is_deleted: true },
      }),
      this.prisma.emailThread.count({
        where: { ...base, status: ThreadStatus.NEW, is_deleted: false },
      }),
    ]);

    return { inbox, starred, archived, trash, unread };
  }

  /* ===============================
     SINGLE THREAD
  =============================== */
  async getThreadWithEmails(thread_id: number) {
    const thread = await this.prisma.emailThread.findUnique({
      where: { id: thread_id },
      include: {
        emails: true,
        labels: {
          include: { label: true },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return thread;
  }

  /* ===============================
     READ / UNREAD
  =============================== */
  async markThreadRead(thread_id: number) {
    await this.prisma.email.updateMany({
      where: { thread_id },
      data: { is_read: true },
    });

    await this.prisma.emailThread.update({
      where: { id: thread_id },
      data: { status: ThreadStatus.OPENED },
    });

    return { success: true };
  }

  async markThreadUnread(thread_id: number) {
    await this.prisma.email.updateMany({
      where: { thread_id },
      data: { is_read: false },
    });

    await this.prisma.emailThread.update({
      where: { id: thread_id },
      data: { status: ThreadStatus.NEW },
    });

    return { success: true };
  }

  /* ===============================
     ARCHIVE
  =============================== */
  archiveThread(id: number) {
    return this.prisma.emailThread.update({
      where: { id, is_deleted: false },
      data: { is_archived: true },
    });
  }

  unarchiveThread(id: number) {
    return this.prisma.emailThread.update({
      where: { id, is_deleted: false },
      data: { is_archived: false },
    });
  }
}
