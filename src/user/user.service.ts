import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateUserDto } from 'src/auth/dto/registerUser.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        business: true,
      },
    });
  }

  async createUser(data: CreateUserDto) {
    let businessId: number | null = null;

    // 🔍 If business_id exists → validate it
    if (data.business_id) {
      const business = await this.prisma.business.findUnique({
        where: { id: data.business_id },
      });

      if (!business) {
        throw new NotFoundException(
          `Business ID ${data.business_id} not found`,
        );
      }

      businessId = data.business_id;
    }

    // 🔐 Hash password
    const hashed = await bcrypt.hash(data.password, 10);

    // ✅ CREATE USER (Prisma schema compliant)
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password_hash: hashed,

        // 🔥 Connect Role
        role: {
          connect: { id: data.role_id },
        },

        // 🔥 Connect Business (optional)
        business: businessId ? { connect: { id: businessId } } : undefined,

        status: data.status ?? null, // Your Prisma schema allows string?
      },
      include: {
        role: true,
        business: true,
      },
    });

    // 🧹 Remove password_hash from response
    const { password_hash, ...cleanUser } = user;

    return cleanUser;
  }
}
