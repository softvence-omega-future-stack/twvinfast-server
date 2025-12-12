// import { Module } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// //! import { ImapController } from './controllers/imap.controller';
// import { ThreadController } from './controllers/thread.controller';
// import { EmailController } from './controllers/email.controller';
// import { ThreadService } from './services/thread.service';
// import { EmailService } from './services/email.service';
// import { MailController } from './controllers/mail.controller';
// import { MailService } from './services/mail.service';
// // !import { ImapService } from './services/imap.service';
// // import { AiService } from './services/ai.service';

// @Module({
//   imports: [],
//   controllers: [
//     MailController,
//     // ImapController,
//     ThreadController,
//     EmailController,
//   ],
//   providers: [
//     PrismaService,
//     MailService,
//     // ImapService,
//     ThreadService,
//     EmailService,
//     // AiService,
//   ],
//   exports: [MailService, ThreadService, EmailService],
//   // ImapService
// })
// export class EmailModule {}

import { Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

import { ThreadController } from './controllers/thread.controller';
import { EmailController } from './controllers/email.controller';

import { ThreadService } from './services/thread.service';
import { EmailService } from './services/email.service';
import { MailService } from './services/mail.service';
import { ImapService } from './services/imap.service';
import { MailboxController } from './controllers/mailbox.controller';
import { MailboxService } from './services/mailbox.service';
import { ImapSyncService } from './services/imap-sync.service';

@Module({
  imports: [],
  controllers: [MailboxController, ThreadController, EmailController],
  providers: [
    PrismaService,
    MailService,
    ImapService,
    ThreadService,
    EmailService,
    MailboxService,
    ImapSyncService,
  ],
  exports: [
    ImapSyncService,
    MailService,
    ThreadService,
    EmailService,
    ImapService,
  ],
})
export class EmailModule {}
