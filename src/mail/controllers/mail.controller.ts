import { Body, Controller, Post } from '@nestjs/common';

import { SendEmailDto } from '../dto/send-email.dto';
import { AiGenerateDto } from '../dto/ai-generate.dto';
import { CustomerSendEmailDto } from '../dto/customer-email.dto';
import { MailService } from '../mail.service';
import { Public } from 'src/auth/decorators/public.decorator';
// import { AiService } from '../services/ai.service';

@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,

    // private readonly aiService: AiService,
  ) {
    console.log('MailController LOADED');
  }

  // SMTP SEND
  @Post('send')
  async sendEmail(@Body() body: SendEmailDto) {
    return this.mailService.sendSMTPEmail({
      business_id: body.business_id,
      mailbox_id: body.mailbox_id,
      user_id: body.user_id,
      to: body.to,
      cc: body.cc || [],
      bcc: body.bcc || [],
      subject: body.subject,
      html: body.html,
    });
  }

  // CUSTOMER → BUSINESS EMAIL (No Auth Required)
  @Public()
  @Post('customer-send')
  sendCustomerMessage(@Body() dto: CustomerSendEmailDto) {
    return this.mailService.customerSendEmail(
      dto.name,
      dto.email,
      dto.subject,
      dto.message,
    );
  }
  // AI REPLY GENERATE
  //   @Post('ai/generate')
  //   async generateAiReply(@Body() body: AiGenerateDto) {
  //     const reply = await this.aiService.generateEmailReply(body.prompt, {
  //       thread_id: body.thread_id,
  //     });

  //     return { reply };
  //   }
}
