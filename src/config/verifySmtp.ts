import { BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { UpdateMailboxDto } from 'src/user/dto/update-mailbox.dto';

export async function verifySmtp(dto: UpdateMailboxDto) {
  // 🔧 FIX 1: Hard validation (clear error before nodemailer)
  if (
    !dto.smtp_host ||
    !dto.smtp_port ||
    !dto.smtp_password ||
    !dto.email_address
  ) {
    throw new BadRequestException(
      'SMTP credentials missing (host, port, email, password required)',
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: dto.smtp_host,
      port: dto.smtp_port,
      secure: dto.is_ssl ?? dto.smtp_port === 465,
      auth: {
        user: dto.email_address,
        pass: dto.smtp_password,
      },

      // 🔧 FIX 2: Timeouts (prevent hanging request)
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    await transporter.verify(); // 🔐 actual verification
    return { success: true };
  } catch (err: any) {
    // 🔧 FIX 3: Clean & user-friendly error
    throw new BadRequestException(`SMTP verification failed: ${err.message}`);
  }
}

export default verifySmtp;
