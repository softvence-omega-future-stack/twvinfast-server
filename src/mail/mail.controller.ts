// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
// } from '@nestjs/common';
// import { MailService } from './mail.service';
// import { CreateMailDto } from './dto/create-mail.dto';
// import { UpdateMailDto } from './dto/update-mail.dto';

// @Controller('mail')
// export class MailController {
//   constructor(private readonly mailService: MailService) {}

//   @Post()
//   create(@Body() createMailDto: CreateMailDto) {
//     return this.mailService.create(createMailDto);
//   }

//   @Get()
//   findAll() {
//     return this.mailService.findAll();
//   }

//   @Get(':id')
//   findOne(@Param('id') id: string) {
//     return this.mailService.findOne(+id);
//   }

//   @Patch(':id')
//   update(@Param('id') id: string, @Body() updateMailDto: UpdateMailDto) {
//     return this.mailService.update(+id, updateMailDto);
//   }

//   @Delete(':id')
//   remove(@Param('id') id: string) {
//     return this.mailService.remove(+id);
//   }
// }
import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('mails')
export class MailController {
  constructor(private readonly mailService: MailService) {}
  @Public()
  @Post('send')
  async sendEmail(@Body() body: any) {
    const { to, subject, html } = body;
    console.log(body);
    return this.mailService.sendMail(to, subject, html);
  }
}
