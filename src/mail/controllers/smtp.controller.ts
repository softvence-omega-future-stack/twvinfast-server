import { Body, Controller, Post } from '@nestjs/common';
import { SmtpService } from '../services/smtp.service';

@Controller('mail/smtp')
export class SmtpController {
  constructor(private readonly smtpService: SmtpService) {}

  @Post('send')
  sendMail(@Body() body: any) {
    return this.smtpService.sendMail(body);
  }

  //   @Post('test')
  //   testSMTP(@Body('mailbox_id') mailbox_id: number) {
  //     return this.smtpService.testConnection(mailbox_id);
  //   }
}
