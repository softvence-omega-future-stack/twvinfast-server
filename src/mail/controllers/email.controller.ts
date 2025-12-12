// import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
// import { EmailService } from '../services/email.service';

// @Controller('emails')
// export class EmailController {
//   constructor(private readonly emailService: EmailService) {}

//   // Get all messages inside a thread
//   @Get('thread/:thread_id')
//   async getByThread(@Param('thread_id', ParseIntPipe) thread_id: number) {
//     return this.emailService.getEmailsByThread(thread_id);
//   }

//   // Mark email as read
//   @Patch('read/:id')
//   async markRead(@Param('id', ParseIntPipe) id: number) {
//     return this.emailService.markAsRead(id);
//   }

//   // Get single email
//   @Get(':id')
//   async getOne(@Param('id', ParseIntPipe) id: number) {
//     return this.emailService.getEmailById(id);
//   }
// }
import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { EmailService } from '../services/email.service';

@Controller('emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('thread/:thread_id')
  getByThread(@Param('thread_id', ParseIntPipe) thread_id: number) {
    return this.emailService.getEmailsByThread(thread_id);
  }

  @Patch('read/:id')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.emailService.markAsRead(id);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.emailService.getEmailById(id);
  }
}
