// import {
//   Controller,
//   Get,
//   Param,
//   ParseIntPipe,
//   Patch,
//   Body,
// } from '@nestjs/common';

// import { AssignThreadDto } from '../dto/thread.dto';
// import { ThreadService } from '../services/thread.service';

// @Controller('threads')
// export class ThreadController {
//   constructor(private readonly threadService: ThreadService) {}

//   // Inbox list for a mailbox
//   @Get(':mailbox_id')
//   async getThreads(@Param('mailbox_id', ParseIntPipe) mailbox_id: number) {
//     return this.threadService.getThreadsByMailbox(mailbox_id);
//   }

//   // Archive thread
//   @Patch('archive/:id')
//   async archive(@Param('id', ParseIntPipe) id: number) {
//     return this.threadService.archiveThread(id);
//   }

//   // Assign agent
//   // @Patch('assign')
//   // async assign(@Body() body: AssignThreadDto) {
//   //   return this.threadService.assignThread(body.thread_id, body.user_id);
//   // }
// }
import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ThreadService } from '../services/thread.service';

@Controller('threads')
export class ThreadController {
  constructor(private readonly threadService: ThreadService) {}

  @Get(':mailbox_id')
  getThreads(@Param('mailbox_id', ParseIntPipe) mailbox_id: number) {
    return this.threadService.getThreadsByMailbox(mailbox_id);
  }

  @Patch('archive/:id')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.threadService.archiveThread(id);
  }
}
