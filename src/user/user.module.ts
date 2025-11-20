import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  exports: [UserService],
  providers: [UserService],
  imports: [PrismaModule],
})
export class UserModule {}
