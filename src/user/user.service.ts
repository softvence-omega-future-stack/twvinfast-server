// import { Injectable } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import * as bcrypt from 'bcrypt';
// import { CreateUserDto } from '../auth/dto/registerUser.dto';

// @Injectable()
// export class UserService {
//   constructor(private prisma: PrismaService) {}

//   async findByEmail(email: string) {
//     return this.prisma.user.findUnique({
//       where: { email },
//       include: { role: true, business: true },
//     });
//   }

//   async createUser(dto: CreateUserDto) {
//     const hashed = await bcrypt.hash(dto.password, 10);

//     const user = await this.prisma.user.create({
//       data: {
//         name: dto.name,
//         email: dto.email,
//         password_hash: hashed,
//         role: { connect: { id: dto.role_id } },
//         business: dto.business_id
//           ? { connect: { id: dto.business_id } }
//           : undefined,
//       },
//       include: { role: true, business: true },
//     });

//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     const { password_hash, ...clean } = user;
//     return clean;
//   }

// }
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../auth/dto/registerUser.dto';
import { UpdateMailboxDto } from './dto/update-mailbox.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // --------------------------
  // FIND BY EMAIL
  // --------------------------
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        business: true,
        mailboxes: true,
        emails: true,
        aiActions: true,
        aiReplies: true,
        hallucinations: true,
      },
    });

    if (!user) return null;

    const { password_hash, ...clean } = user;
    return clean;
  }

  // --------------------------
  // CREATE USER (ADMIN/SUPER ADMIN USE)
  // --------------------------
  // async createUser(dto: CreateUserDto) {
  //   const hashed = await bcrypt.hash(dto.password, 10);

  //   const user = await this.prisma.user.create({
  //     data: {
  //       name: dto.name,
  //       email: dto.email,
  //       password_hash: hashed,
  //       role: { connect: { id: dto.role_id } },
  //       business: dto.business_id
  //         ? { connect: { id: dto.business_id } }
  //         : undefined,
  //     },
  //     include: {
  //       role: true,
  //       business: true,
  //     },
  //   });

  //   const { password_hash, ...clean } = user;
  //   return clean;
  // }

  // --------------------------
  // GET ALL USERS
  // --------------------------
  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        role: true,
        business: true,
      },
    });

    return users.map(({ password_hash, ...rest }) => rest);
  }

  // --------------------------
  // GET ONE USER BY ID
  // --------------------------
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        business: true,
        mailboxes: true,
        emails: true,
        aiActions: true,
        aiReplies: true,
        hallucinations: true,
      },
    });

    if (!user) return null;

    const { password_hash, ...clean } = user;
    return clean;
  }

  // --------------------------
  // UPDATE USER (ADMIN PANEL থেকে)
  // --------------------------
  async updateUser(id: number, data: any) {
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        status: data.status,
        two_factor_enabled: data.two_factor_enabled,
        last_login_at: data.last_login_at,
        refreshToken: data.refreshToken,
        role: data.role_id ? { connect: { id: data.role_id } } : undefined,
        business: data.business_id
          ? { connect: { id: data.business_id } }
          : data.business_id === null
            ? { disconnect: true }
            : undefined,
      },
      include: {
        role: true,
        business: true,
      },
    });

    const { password_hash, ...clean } = updated;
    return clean;
  }

  // --------------------------
  // DELETE USER
  // --------------------------
  async deleteUser(id: number) {
    const deleted = await this.prisma.user.delete({
      where: { id },
      include: {
        role: true,
        business: true,
      },
    });

    const { password_hash, ...clean } = deleted;
    return clean;
  }

  // --------------------------
  // SELF PROFILE UPDATE (optional – যদি আগে যুক্ত করো)
  // --------------------------
  async updateSelf(id: number, data: any) {
    const updateData: any = {};

    if (data.name) updateData.name = data.name;

    if (data.password) {
      updateData.password_hash = await bcrypt.hash(data.password, 10);
    }

    if (data.two_factor_enabled !== undefined) {
      updateData.two_factor_enabled = data.two_factor_enabled;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true, business: true },
    });

    const { password_hash, ...clean } = updated;
    return clean;
  }

  // ==============================
  // ✨ MAILBOX LOGIC INSIDE USER SERVICE
  // ==============================

  // USER-এর সব mailbox (সাধারণত ১টা, কিন্তু future-proof)
  async getMyMailboxes(userId: number) {
    return this.prisma.mailbox.findMany({
      where: { user_id: userId },
    });
  }

  async upsertMyPrimaryMailbox(userId: number, dto: UpdateMailboxDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.business_id) {
      throw new BadRequestException('User has no business assigned');
    }

    // প্রতি user + business combo এর জন্য ১টা mailbox
    const existing = await this.prisma.mailbox.findFirst({
      where: {
        user_id: userId,
        business_id: user.business_id,
      },
    });

    // -------------------------------------------
    // ⭐ UPDATE mailbox IF EXISTS
    // -------------------------------------------
    if (existing) {
      return this.prisma.mailbox.update({
        where: { id: existing.id },
        data: {
          provider: dto.provider ?? undefined,
          email_address: dto.email_address ?? undefined,
          imap_host: dto.imap_host ?? undefined,
          imap_port: dto.imap_port ?? undefined,
          smtp_host: dto.smtp_host ?? undefined,
          smtp_port: dto.smtp_port ?? undefined,
          imap_password: dto.imap_password ?? undefined,
          smtp_password: dto.smtp_password ?? undefined,  
          is_ssl: dto.is_ssl ?? undefined,
        },
      });
    }

    // -------------------------------------------
    // ⭐ CREATE mailbox IF NOT EXISTS
    // -------------------------------------------
    return this.prisma.mailbox.create({
      data: {
        business_id: user.business_id,
        user_id: userId,
        provider: dto.provider ?? 'SMTP',
        email_address: dto.email_address ?? user.email,

        // Prisma optional fields → must be undefined to skip OR null if user sends null
        imap_host: dto.imap_host ?? undefined,
        imap_port: dto.imap_port ?? undefined,

        smtp_host: dto.smtp_host ?? undefined,
        smtp_port: dto.smtp_port ?? undefined,

        is_ssl: dto.is_ssl ?? true,
      },
    });
  }
}
