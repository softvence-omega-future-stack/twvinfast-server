
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
