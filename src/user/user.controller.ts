import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateMailboxDto } from './dto/update-mailbox.dto';
import { JwtAuthGuard } from 'src/auth/strategies/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // -----------------------------------------
  // ADMIN: Get All Users
  // -----------------------------------------
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  // -----------------------------------------
  // ADMIN: Get Single User
  // -----------------------------------------
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(Number(id));
  }

  // -----------------------------------------
  // ADMIN: Update User
  // -----------------------------------------
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.userService.updateUser(Number(id), dto);
  }

  // -----------------------------------------
  // ADMIN: Delete User
  // -----------------------------------------
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.deleteUser(Number(id));
  }

  // =======================================================
  // USER SELF PROFILE → MAILBOX ACCESS & UPDATE
  // =======================================================

  // -----------------------------------------
  // USER: Get My Mailbox Info
  // -----------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('me/mailbox')
  getMyMailbox(@Req() req) {
    return this.userService.getMyMailboxes(req.user.sub);
  }

  // USER: Update My IMAP / SMTP Settings
  @UseGuards(JwtAuthGuard)
  @Patch('me/mailbox')
  updateMyMailbox(@Req() req, @Body() dto: UpdateMailboxDto) {
    const userId = Number(req.user.sub);
    3;
    return this.userService.upsertMyPrimaryMailbox(userId, dto);
  }
}
