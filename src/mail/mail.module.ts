
import { Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

import { ThreadController } from './controllers/thread.controller';
import { EmailController } from './controllers/email.controller';

import { ThreadService } from './services/thread.service';
import { EmailService } from './services/email.service';
import { MailService } from './services/mail.service';
import { MailboxController } from './controllers/mailbox.controller';
import { MailboxService } from './services/mailbox.service';
import { ImapSyncService } from './services/imap-sync.service';

@Module({
  imports: [],
  controllers: [MailboxController, ThreadController, EmailController],
  providers: [
    PrismaService,
    MailService,
    ThreadService,
    EmailService,
    MailboxService,
    ImapSyncService,
  ],
  exports: [ImapSyncService, MailService, ThreadService, EmailService],
})
export class EmailModule {}
