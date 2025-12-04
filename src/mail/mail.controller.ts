import { Controller, Post, Body, Get } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}
  @Post('send')
  sendEmail(@Body() body) {
    return this.mailService.sendSMTPEmail({
      business_id: body.business_id,
      mailbox_id: body.mailbox_id,
      user_id: body.user_id,
      to: body.to, // ["client@gmail.com"]
      cc: body.cc || [],
      bcc: body.bcc || [],
      subject: body.subject,
      html: body.html,
    });
  }
}
