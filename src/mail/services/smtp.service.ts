import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from 'prisma/prisma.service';
import { htmlToText } from 'html-to-text';
import { cleanEmailText } from '../../common/utils/clean-email-text';

@Injectable()
export class SmtpService {
  constructor(private prisma: PrismaService) {}

  // async sendMail(payload: {
  //   mailbox_id: number;
  //   to: string | string[];
  //   subject: string;
  //   html: string;
  // }) {
  //   try {
  //     /* ===============================
  //        NORMALIZE RECIPIENTS
  //     =============================== */
  //     const toList = Array.isArray(payload.to) ? payload.to : [payload.to];

  //     if (!toList.length) {
  //       throw new Error('Recipient missing');
  //     }

  //     const toEmail = toList[0].toLowerCase();

  //     /* ===============================
  //        MAILBOX
  //     =============================== */
  //     const mailbox = await this.prisma.mailbox.findUnique({
  //       where: { id: payload.mailbox_id },
  //     });

  //     if (!mailbox || !mailbox.smtp_password) {
  //       throw new Error('Invalid mailbox or SMTP config');
  //     }

  //     /* ===============================
  //        CUSTOMER (🔥 FIXED: UPSERT)
  //     =============================== */
  //     const customer = await this.prisma.customer.upsert({
  //       where: {
  //         business_email_unique: {
  //           business_id: mailbox.business_id,
  //           email: toEmail,
  //         },
  //       },
  //       update: {
  //         last_contact_at: new Date(),
  //       },
  //       create: {
  //         business_id: mailbox.business_id,
  //         email: toEmail,
  //         name: toEmail.split('@')[0],
  //         source: 'OUTBOUND_EMAIL',
  //         last_contact_at: new Date(),
  //       },
  //     });

  //     /* ===============================
  //        THREAD (SAFE)
  //     =============================== */
  //     let thread = await this.prisma.emailThread.findFirst({
  //       where: {
  //         mailbox_id: mailbox.id,
  //         customer_id: customer.id,
  //       },
  //       orderBy: { last_message_at: 'desc' },
  //     });

  //     if (!thread) {
  //       thread = await this.prisma.emailThread.create({
  //         data: {
  //           business_id: mailbox.business_id,
  //           mailbox_id: mailbox.id,
  //           customer_id: customer.id,
  //           subject: payload.subject,
  //           last_message_at: new Date(),
  //         },
  //       });
  //     }

  //     /* ===============================
  //        SMTP SEND
  //     =============================== */
  //     const transporter = nodemailer.createTransport({
  //       host: 'smtp.gmail.com',
  //       port: mailbox.smtp_port,
  //       secure: mailbox.smtp_port === 465,
  //       auth: {
  //         user: mailbox.email_address,
  //         pass: mailbox.smtp_password,
  //       },
  //     });

  //     const info = await transporter.sendMail({
  //       from: mailbox.email_address,
  //       to: toList,
  //       subject: payload.subject.startsWith('Re:')
  //         ? payload.subject
  //         : `Re: ${payload.subject}`,
  //       html: payload.html,

  //       // 🔥 THREAD FIX (EMAIL PROTOCOL)
  //       inReplyTo: thread.last_message_id ?? undefined,
  //       references: thread.references ?? undefined,
  //     });

  //     /* ===============================
  //        BODY TEXT (CLEAN)
  //     =============================== */
  //     const rawText = htmlToText(payload.html, {
  //       wordwrap: false,
  //       selectors: [{ selector: 'a', options: { ignoreHref: true } }],
  //     });

  //     const body_text = cleanEmailText(rawText) || '(no content)';

  //     /* ===============================
  //        SAVE EMAIL (OUTBOUND)
  //     =============================== */
  //     await this.prisma.email.create({
  //       data: {
  //         business_id: mailbox.business_id,
  //         user_id: mailbox.user_id,
  //         mailbox_id: mailbox.id,
  //         thread_id: thread.id,

  //         message_id: info.messageId,
  //         in_reply_to: thread.last_message_id,
  //         references: thread.references,

  //         from_address: mailbox.email_address,
  //         subject: payload.subject,
  //         body_html: payload.html,
  //         body_text,
  //         folder: 'SENT',
  //         sent_at: new Date(),
  //       },
  //     });

  //     /* ===============================
  //        UPDATE THREAD META
  //     =============================== */
  //     await this.prisma.emailThread.update({
  //       where: { id: thread.id },
  //       data: {
  //         last_message_at: new Date(),
  //         last_message_id: info.messageId,
  //         references: thread.references
  //           ? `${thread.references} ${info.messageId}`
  //           : info.messageId,
  //       },
  //     });

  //     return {
  //       success: true,
  //       messageId: info.messageId,
  //       thread_id: thread.id,
  //     };
  //   } catch (err: any) {
  //     console.error('SMTP ERROR →', err);
  //     throw new InternalServerErrorException(err.message);
  //   }
  // }
  async sendMail(payload: {
    mailbox_id: number;
    to: string | string[];
    subject: string;
    html: string;
    files?: Express.Multer.File[];
  }) {
    try {
      const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
      if (!toList.length) throw new Error('Recipient missing');

      const toEmail = toList[0].toLowerCase();

      const mailbox = await this.prisma.mailbox.findUnique({
        where: { id: payload.mailbox_id },
      });
      if (!mailbox || !mailbox.smtp_password) {
        throw new Error('Invalid mailbox or SMTP config');
      }

      /* CUSTOMER */
      const customer = await this.prisma.customer.upsert({
        where: {
          business_email_unique: {
            business_id: mailbox.business_id,
            email: toEmail,
          },
        },
        update: { last_contact_at: new Date() },
        create: {
          business_id: mailbox.business_id,
          email: toEmail,
          name: toEmail.split('@')[0],
          source: 'OUTBOUND_EMAIL',
          last_contact_at: new Date(),
        },
      });

      /* THREAD */
      let thread = await this.prisma.emailThread.findFirst({
        where: {
          mailbox_id: mailbox.id,
          customer_id: customer.id,
        },
        orderBy: { last_message_at: 'desc' },
      });

      if (!thread) {
        thread = await this.prisma.emailThread.create({
          data: {
            business_id: mailbox.business_id,
            mailbox_id: mailbox.id,
            customer_id: customer.id,
            subject: payload.subject,
            last_message_at: new Date(),
          },
        });
      }

      /* SMTP */
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: mailbox.smtp_port,
        secure: mailbox.smtp_port === 465,
        auth: {
          user: mailbox.email_address,
          pass: mailbox.smtp_password,
        },
      });

      // ✅ ATTACHMENTS
      const attachments =
        payload.files?.map((file) => ({
          filename: file.originalname,
          path: file.path, // DigitalOcean hosted
          contentType: file.mimetype,
        })) || [];

      const info = await transporter.sendMail({
        from: mailbox.email_address,
        to: toList,
        subject: payload.subject.startsWith('Re:')
          ? payload.subject
          : `Re: ${payload.subject}`,
        html: payload.html,
        attachments,
        inReplyTo: thread.last_message_id ?? undefined,
        references: thread.references ?? undefined,
      });

      /* SAVE EMAIL */
      await this.prisma.email.create({
        data: {
          business_id: mailbox.business_id,
          user_id: mailbox.user_id,
          mailbox_id: mailbox.id,
          thread_id: thread.id,
          message_id: info.messageId,
          in_reply_to: thread.last_message_id,
          references: thread.references,
          from_address: mailbox.email_address,
          subject: payload.subject,
          body_html: payload.html,
          body_text: cleanEmailText(
            htmlToText(payload.html, { wordwrap: false }),
          ),
          folder: 'SENT',
          sent_at: new Date(),
        },
      });

      await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          last_message_at: new Date(),
          last_message_id: info.messageId,
          references: thread.references
            ? `${thread.references} ${info.messageId}`
            : info.messageId,
        },
      });

      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message);
    }
  }
}
