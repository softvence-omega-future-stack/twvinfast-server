import {
  Controller,
  Post,
  Body,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SmtpService } from '../services/smtp.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('mail/smtp')
export class SmtpController {
  constructor(private readonly smtpService: SmtpService) {}

  @Post('send')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads/mail',
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
    }),
  )
  async sendMail(
    @Body('data') data: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {

    // added comment
    // 🔥 data আসে string হিসেবে → parse করতেই হবে
    const payload = JSON.parse(data);

    return this.smtpService.sendMail({
      ...payload,
      files,
    });
  }
}
