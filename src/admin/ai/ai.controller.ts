import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { UploadAiDocDto } from './dto/upload-ai-doc.dto';

@Controller('admin/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // 📤 Upload
  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(@UploadedFile() file: Express.Multer.File, @Req() req) {
    return this.aiService.uploadDocument(file, req.user);
  }

  // 📄 List
  @Get('documents')
  listDocuments(@Req() req) {
    return this.aiService.listDocuments(req.user.business_id);
  }

  // 🗑 Delete
  @Delete('documents/:id')
  deleteDocument(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.aiService.deleteDocument(id, req.user);
  }
}
