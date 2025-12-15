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
import { SmtpController } from './controllers/smtp.controller';
import { SmtpService } from './services/smtp.service';

@Module({
  imports: [],
  controllers: [
    MailboxController,
    ThreadController,
    EmailController,
    SmtpController,
  ],
  providers: [
    PrismaService,
    MailService,
    ThreadService,
    EmailService,
    MailboxService,
    ImapSyncService,
    SmtpService,
  ],
  exports: [
    ImapSyncService,
    MailService,
    ThreadService,
    EmailService,
    SmtpService,
  ],
})
export class EmailModule {}
