import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { ImapService } from './imap.service';

@Module({
  imports: [PrismaModule],
  controllers: [MailController],
  providers: [MailService, ImapService],
})
export class MailModule {}
