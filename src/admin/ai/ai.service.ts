import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as fs from 'fs';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async uploadDocument(file: Express.Multer.File, user: any) {
    if (!file) throw new Error('File required');

    const doc = await this.prisma.aiTrainingDocument.create({
      data: {
        business_id: user.business_id,
        uploaded_by: user.id,
        original_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size,
      },
    });

    // 🔔 Optional: notify AI service here
    // emit / webhook / queue

    return { success: true, document: doc };
  }

  async listDocuments(businessId: number) {
    return this.prisma.aiTrainingDocument.findMany({
      where: {
        business_id: businessId,
        status: 'ACTIVE',
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async deleteDocument(id: number, user: any) {
    const doc = await this.prisma.aiTrainingDocument.findUnique({
      where: { id },
    });

    if (!doc) throw new NotFoundException('Document not found');
    if (doc.business_id !== user.business_id) throw new ForbiddenException();

    // 🗑 delete file
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    await this.prisma.aiTrainingDocument.update({
      where: { id },
      data: {
        status: 'DELETED',
        deleted_at: new Date(),
      },
    });

    // 🔔 notify AI service (cleanup embeddings)
    return { success: true };
  }
}
