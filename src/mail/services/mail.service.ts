import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from 'prisma/prisma.service';

interface SendSMTPPayload {
  business_id: number;
  mailbox_id: number;
  user_id?: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465, // SSL for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendSMTPEmail({
    business_id,
    mailbox_id,
    user_id,
    to,
    cc = [],
    bcc = [],
    subject,
    html,
  }: SendSMTPPayload) {
    // 1) Send Email via SMTP
    const smtpInfo = await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      cc,
      bcc,
      subject,
      html,
    });

    const messageId = smtpInfo.messageId || null;

    // 2) Verify business & mailbox
    const business = await this.prisma.business.findUnique({
      where: { id: business_id },
    });
    if (!business) {
      throw new Error(`Business ID ${business_id} does not exist`);
    }

    const mailbox = await this.prisma.mailbox.findUnique({
      where: { id: mailbox_id },
    });
    if (!mailbox) {
      throw new Error(`Mailbox ID ${mailbox_id} does not exist`);
    }

    // 3) Find or create thread
    let thread = await this.prisma.emailThread.findFirst({
      where: {
        mailbox_id,
        subject,
      },
    });

    if (!thread) {
      thread = await this.prisma.emailThread.create({
        data: {
          business_id,
          mailbox_id,
          subject,
          customer_id: null,
          last_message_at: new Date(),
        },
      });
    } else {
      await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: { last_message_at: new Date() },
      });
    }

    // 4) Save email record
    const email = await this.prisma.email.create({
      data: {
        business_id,
        mailbox_id,
        thread_id: thread.id,
        user_id: user_id ?? null,

        message_id: messageId,
        in_reply_to: null,

        from_address: process.env.SMTP_USER,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,

        subject,
        body_html: html,
        body_text: null,

        folder: 'SENT',
        sent_at: new Date(),
        received_at: null,
        is_read: true,
      },
    });

    return {
      success: true,
      thread_id: thread.id,
      email_id: email.id,
      message_id: messageId,
    };
  }
  async customerSendEmail(
    name: string,
    email: string,
    subject: string,
    message: string,
  ) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${name}" <${email}>`,
        to: process.env.BUSINESS_INBOX,
        subject,
        html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>New Customer Email</h2>

          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>

          <hr/>

          <p>${message}</p>
        </div>
      `,
      });

      return {
        success: true,
        message: 'Customer email delivered successfully',
        messageId: info.messageId,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to send customer email');
    }
  }
}
