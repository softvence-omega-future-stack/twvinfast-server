import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ThreadService {
  constructor(private prisma: PrismaService) {}

  getThreadsByMailbox(mailbox_id: number) {
    return this.prisma.emailThread.findMany({
      where: {
        mailbox_id,
        is_archived: false,
      },
      orderBy: {
        last_message_at: 'desc',
      },
    });
  }

  archiveThread(id: number) {
    return this.prisma.emailThread.update({
      where: { id },
      data: { is_archived: true },
    });
  }

  // assignThread(thread_id: number, user_id: number) {
  //   return this.prisma.emailThread.update({
  //     where: { id: thread_id },
  //     data: { assigned_user_id: user_id },
  //   });
  // }
}
