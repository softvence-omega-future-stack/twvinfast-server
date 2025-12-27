import {
  Controller,
  Post,
  Body,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SmtpService } from '../services/smtp.service';
import { mailMulterConfig } from 'src/config/multer.config';

@Controller('mail/smtp')
export class SmtpController {
  constructor(private readonly smtpService: SmtpService) {}

  /* ============ SEND MAIL ============ */
  @Post('send')
  @UseInterceptors(FilesInterceptor('files', 10, mailMulterConfig))
  async sendMail(
    @Body('data') data: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const payload = JSON.parse(data);
    return this.smtpService.sendMail({
      ...payload,
      files,
    });
  }
  /* ============ SAVE DRAFT ============ */
  @Post('draft')
  @UseInterceptors(FilesInterceptor('files', 10, mailMulterConfig))
  async saveDraft(
    @Body('data') data: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const payload = JSON.parse(data);

    return this.smtpService.saveDraft({
      ...payload,
      files,
    });
  }

  //
  /* ============ AI GENERATE EMAIL ============ */
  @Post('generate')
  async generateEmail(
    @Body('prompt') prompt: string,
    @Body('organization_name') organizationName: string,
    @Body('tone') tone?: string,
  ) {
    return this.smtpService.generateEmail({
      prompt,
      organization_name: organizationName,
      tone,
    });
  }
}
