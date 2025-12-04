// import { Controller, Post, Body, Get, Param } from '@nestjs/common';
// import { MailService } from './mail.service';

// @Controller('mail')
// export class MailController {
//   prisma: any;
//   constructor(private readonly mailService: MailService) {}
//   @Post('send')
//   sendEmail(@Body() body) {
//     return this.mailService.sendSMTPEmail({
//       business_id: body.business_id,
//       mailbox_id: body.mailbox_id,
//       user_id: body.user_id,
//       to: body.to, // ["client@gmail.com"]
//       cc: body.cc || [],
//       bcc: body.bcc || [],
//       subject: body.subject,
//       html: body.html,
//     });
//   }

//   @Get('all/:business_id')
//   getAllMailboxes(@Param('business_id') business_id: number) {
//     return this.prisma.mailbox.findMany({
//       where: { business_id },
//     });
//   }
// }
