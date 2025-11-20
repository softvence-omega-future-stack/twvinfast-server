import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateUserDto } from 'src/auth/dto/registerUser.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async createUser(data: CreateUserDto) {
    let companyId: number | null = null;

    // 🔍 If companyId is provided, attempt to validate
    if (data.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: data.companyId },
      });

      // If exists → use it, otherwise → ignore and set null
      if (company) {
        companyId = data.companyId;
      }
    }
    // ✅ CREATE user safely
    const result = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role ?? 'USER',
        status: data.status ?? 'ACTIVE',
        companyId,
        location: data.location,
        twoFA: data.twoFA ?? false,
        emailSignature: data.emailSignature,
        timeZone: data.timeZone,
      },
    });
    const { password, ...userWithoutPassword } = result;

    return userWithoutPassword;
  }
}
