// import { Injectable } from '@nestjs/common';
// import * as nodemailer from 'nodemailer';

// @Injectable()
// export class MailService {
//   private transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST, // mail.webador.com
//     port: Number(process.env.SMTP_PORT) || 587, // 587 = STARTTLS
//     secure: false, // MUST false on port 587
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//     tls: {
//       rejectUnauthorized: false, // FIXES Webador TLS issue
//     },
//     logger: true, // logs SMTP commands
//     debug: true,
//   });

//   async sendMail(to: string, subject: string, html: string) {
//     return await this.transporter.sendMail({
//       from: `"AI Bot" <${process.env.SMTP_USER}>`,
//       to,
//       subject,
//       html,
//     });
//   }
// }

import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from 'prisma/prisma.service';

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
  }: {
    business_id: number;
    mailbox_id: number;
    user_id?: number;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
  }) {
    // -----------------------------------------------------------
    // 1) Send Email by SMTP
    // -----------------------------------------------------------
    const smtpInfo = await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      cc,
      bcc,
      subject,
      html,
    });

    const messageId = smtpInfo.messageId || null;

    // Add
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

    // -----------------------------------------------------------
    // 2) Find or Create EmailThread
    // -----------------------------------------------------------
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
          customer_id: null, // no customer yet for outbound
          last_message_at: new Date(),
        },
      });
    } else {
      // Update last message time
      await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: { last_message_at: new Date() },
      });
    }

    // -----------------------------------------------------------
    // 3) Save Email record
    // -----------------------------------------------------------
    const email = await this.prisma.email.create({
      data: {
        business_id,
        mailbox_id,
        thread_id: thread.id,
        user_id: user_id ?? null,

        // SMTP Meta
        message_id: messageId,
        in_reply_to: null, // can fill later if thread exists

        // Addresses
        from_address: process.env.SMTP_USER,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,

        // Content
        subject,
        body_html: html,
        body_text: null,

        // State
        folder: 'SENT',
        sent_at: new Date(),
        received_at: null,
      },
    });

    return {
      success: true,
      thread_id: thread.id,
      email_id: email.id,
      message_id: messageId,
    };
  }
}
