import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ThreadService } from '../services/thread.service';

@Controller('threads')
export class ThreadController {
  constructor(private readonly threadService: ThreadService) {}

  /* ===============================
     INBOX / THREAD LIST
  =============================== */

  // GET /threads?mailbox_id=1
  @Get()
  getThreads(@Query('mailbox_id', ParseIntPipe) mailbox_id: number) {
    return this.threadService.getThreadsByMailbox(mailbox_id);
  }

  /* ===============================
     SINGLE THREAD (CONVERSATION)
  =============================== */

  // GET /threads/12
  @Get(':id')
  getThread(@Param('id', ParseIntPipe) id: number) {
    return this.threadService.getThreadWithEmails(id);
  }

  /* ===============================
     ARCHIVE / UNARCHIVE
  =============================== */

  // PATCH /threads/12/archive
  @Patch(':id/archive')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.threadService.archiveThread(id);
  }

  // PATCH /threads/12/unarchive
  @Patch(':id/unarchive')
  unarchive(@Param('id', ParseIntPipe) id: number) {
    return this.threadService.unarchiveThread(id);
  }

  /* ===============================
     READ / UNREAD
  =============================== */

  // PATCH /threads/12/read
  @Patch(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.threadService.markThreadRead(id);
  }

  // PATCH /threads/12/unread
  @Patch(':id/unread')
  markUnread(@Param('id', ParseIntPipe) id: number) {
    return this.threadService.markThreadUnread(id);
  }
}
