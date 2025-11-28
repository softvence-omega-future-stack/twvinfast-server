import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../auth/dto/registerUser.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true, business: true },
    });
  }

  async createUser(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password_hash: hashed,
        role: { connect: { id: dto.role_id } },
        business: dto.business_id
          ? { connect: { id: dto.business_id } }
          : undefined,
      },
      include: { role: true, business: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...clean } = user;
    return clean;
  }
}
