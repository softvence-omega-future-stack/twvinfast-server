import { Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ImapController } from './controllers/imap.controller';
import { ThreadController } from './controllers/thread.controller';
import { EmailController } from './controllers/email.controller';
import { ImapService } from './imap.service';
import { ThreadService } from './services/thread.service';
import { EmailService } from './services/email.service';
import { MailService } from './mail.service';
import { MailController } from './controllers/mail.controller';
// import { AiService } from './services/ai.service';

@Module({
  imports: [],
  controllers: [
    MailController,
    ImapController,
    ThreadController,
    EmailController,
  ],
  providers: [
    PrismaService,
    MailService,
    ImapService,
    ThreadService,
    EmailService,
    // AiService,
  ],
  exports: [MailService, ImapService, ThreadService, EmailService],
})
export class EmailModule {}
