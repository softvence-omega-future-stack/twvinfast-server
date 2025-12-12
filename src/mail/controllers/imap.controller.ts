// import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
// import { ImapService } from '../services/imap.service';

// @Controller('mail')
// export class ImapController {
//   constructor(private readonly imapService: ImapService) {}

//   // Manual sync from frontend button
//   @Post('sync/:mailbox_id')
//   async manualSync(@Param('mailbox_id', ParseIntPipe) mailbox_id: number) {
//     await this.imapService.syncInbox(mailbox_id);
//     return { success: true, mailbox_id };
//   }
// }
import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ImapService } from '../services/imap.service';

@Controller('mail')
export class ImapController {
  constructor(private readonly imapService: ImapService) {}

  @Post('sync/:mailbox_id')
  async manualSync(@Param('mailbox_id', ParseIntPipe) mailbox_id: number) {
    await this.imapService.syncInbox(mailbox_id);
    return { success: true, mailbox_id };
  }
}
