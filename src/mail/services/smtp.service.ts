import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from 'prisma/prisma.service';
import { htmlToText } from 'html-to-text';
import { cleanEmailText } from '../../common/utils/clean-email-text';

@Injectable()
export class SmtpService {
  constructor(private prisma: PrismaService) {}

  /* ================= SEND EMAIL ================= */
  // async sendMail(payload: {
  //   mailbox_id: number;
  //   draft_id?: number;
  //   to: string | string[];
  //   cc?: string | string[];
  //   bcc?: string | string[];
  //   subject: string;
  //   html: string;
  //   files?: Express.Multer.File[];
  // }) {
  //   try {
  //     const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
  //     if (!toList.length) throw new Error('Recipient missing');

  //     const toEmail = toList[0].toLowerCase();

  //     const mailbox = await this.prisma.mailbox.findUnique({
  //       where: { id: payload.mailbox_id },
  //     });

  //     if (!mailbox || !mailbox.smtp_password) {
  //       throw new Error('Invalid mailbox or SMTP config');
  //     }

  //     /* ---------- CUSTOMER ---------- */
  //     const customer = await this.prisma.customer.upsert({
  //       where: {
  //         business_email_unique: {
  //           business_id: mailbox.business_id,
  //           email: toEmail,
  //         },
  //       },
  //       update: { last_contact_at: new Date() },
  //       create: {
  //         business_id: mailbox.business_id,
  //         email: toEmail,
  //         name: toEmail.split('@')[0],
  //         source: 'OUTBOUND_EMAIL',
  //         last_contact_at: new Date(),
  //       },
  //     });

  //     /* ---------- THREAD ---------- */
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

  //     /* ---------- SMTP ---------- */
  //     const transporter = nodemailer.createTransport({
  //       host: 'smtp.gmail.com',
  //       port: mailbox.smtp_port,
  //       secure: mailbox.smtp_port === 465,
  //       auth: {
  //         user: mailbox.email_address,
  //         pass: mailbox.smtp_password,
  //       },
  //     });

  //     const attachments =
  //       payload.files?.map((file) => ({
  //         filename: file.originalname,
  //         path: file.path,
  //         contentType: file.mimetype,
  //       })) || [];

  //     const info = await transporter.sendMail({
  //       from: mailbox.email_address,
  //       to: toList,
  //       cc: payload.cc,
  //       bcc: payload.bcc,
  //       subject: payload.subject.startsWith('Re:')
  //         ? payload.subject
  //         : `Re: ${payload.subject}`,
  //       html: payload.html,
  //       attachments,
  //       inReplyTo: thread.last_message_id ?? undefined,
  //       references: thread.references ?? undefined,
  //     });

  //     /* ---------- SAVE EMAIL ---------- */
  //     if (payload.draft_id) {
  //       // UPDATE DRAFT → SENT
  //       await this.prisma.email.update({
  //         where: { id: payload.draft_id },
  //         data: {
  //           message_id: info.messageId,
  //           folder: 'SENT',
  //           sent_at: new Date(),
  //           body_html: payload.html,
  //           body_text: cleanEmailText(
  //             htmlToText(payload.html, { wordwrap: false }),
  //           ),
  //         },
  //       });
  //     } else {
  //       // NORMAL SEND
  //       await this.prisma.email.create({
  //         data: {
  //           business_id: mailbox.business_id,
  //           user_id: mailbox.user_id,
  //           mailbox_id: mailbox.id,
  //           thread_id: thread.id,
  //           message_id: info.messageId,
  //           from_address: mailbox.email_address,
  //           subject: payload.subject,
  //           body_html: payload.html,
  //           body_text: cleanEmailText(
  //             htmlToText(payload.html, { wordwrap: false }),
  //           ),
  //           folder: 'SENT',
  //           sent_at: new Date(),
  //         },
  //       });
  //     }

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

  //     return { success: true, messageId: info.messageId };
  //   } catch (err: any) {
  //     throw new InternalServerErrorException(err.message);
  //   }
  // }
  async sendMail(payload: {
    mailbox_id: number;
    draft_id?: number;
    forward_message_id?: number; // ✅ NEW
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    files?: Express.Multer.File[];
  }) {
    try {
      const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
      if (!toList.length) throw new Error('Recipient missing');

      const toEmail = toList[0].toLowerCase();
      const isForward = Boolean(payload.forward_message_id); // ✅ NEW

      const mailbox = await this.prisma.mailbox.findUnique({
        where: { id: payload.mailbox_id },
      });

      if (!mailbox || !mailbox.smtp_password) {
        throw new Error('Invalid mailbox or SMTP config');
      }

      /* ---------- CUSTOMER ---------- */
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
          source: isForward ? 'FORWARDED_EMAIL' : 'OUTBOUND_EMAIL',
          last_contact_at: new Date(),
        },
      });

      /* ---------- THREAD ---------- */
      let thread;

      if (isForward) {
        // ✅ Forward = NEW THREAD
        thread = await this.prisma.emailThread.create({
          data: {
            business_id: mailbox.business_id,
            mailbox_id: mailbox.id,
            customer_id: customer.id,
            subject: payload.subject.startsWith('Fwd:')
              ? payload.subject
              : `Fwd: ${payload.subject}`,
            last_message_at: new Date(),
          },
        });
      } else {
        // ✅ Reply / normal send = existing thread
        thread = await this.prisma.emailThread.findFirst({
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
      }

      /* ---------- SMTP ---------- */
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: mailbox.smtp_port,
        secure: mailbox.smtp_port === 465,
        auth: {
          user: mailbox.email_address,
          pass: mailbox.smtp_password,
        },
      });

      const attachments =
        payload.files?.map((file) => ({
          filename: file.originalname,
          path: file.path,
          contentType: file.mimetype,
        })) || [];

      const info = await transporter.sendMail({
        from: mailbox.email_address,
        to: toList,
        cc: payload.cc,
        bcc: payload.bcc,
        subject: isForward
          ? payload.subject.startsWith('Fwd:')
            ? payload.subject
            : `Fwd: ${payload.subject}`
          : payload.subject.startsWith('Re:')
            ? payload.subject
            : `Re: ${payload.subject}`,
        html: payload.html,
        attachments,

        // 🔴 Forward হলে এগুলো যাবে না
        inReplyTo: isForward
          ? undefined
          : (thread.last_message_id ?? undefined),
        references: isForward ? undefined : (thread.references ?? undefined),
      });

      /* ---------- SAVE EMAIL ---------- */
      if (payload.draft_id && !isForward) {
        // draft → sent (reply case)
        await this.prisma.email.update({
          where: { id: payload.draft_id },
          data: {
            message_id: info.messageId,
            folder: 'SENT',
            sent_at: new Date(),
            body_html: payload.html,
            body_text: cleanEmailText(
              htmlToText(payload.html, { wordwrap: false }),
            ),
          },
        });
      } else {
        // normal send OR forward
        await this.prisma.email.create({
          data: {
            business_id: mailbox.business_id,
            user_id: mailbox.user_id,
            mailbox_id: mailbox.id,
            thread_id: thread.id,
            message_id: info.messageId,
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
      }

      await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          last_message_at: new Date(),
          last_message_id: info.messageId,
          references: isForward
            ? null
            : thread.references
              ? `${thread.references} ${info.messageId}`
              : info.messageId,
        },
      });

      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /* ================= SAVE DRAFT ================= */
  async saveDraft(payload: {
    mailbox_id: number;
    to?: string | string[];
    subject?: string;
    html?: string;
    thread_id?: number;
    draft_id?: number;
    files?: Express.Multer.File[];
  }) {
    const toEmail = Array.isArray(payload.to)
      ? payload.to[0].toLowerCase()
      : payload.to!.toLowerCase();

    const mailbox = await this.prisma.mailbox.findUnique({
      where: { id: payload.mailbox_id },
    });

    if (!mailbox) throw new Error('Mailbox not found');

    const customer = await this.prisma.customer.upsert({
      where: {
        business_email_unique: {
          business_id: mailbox.business_id,
          email: toEmail,
        },
      },
      update: {},
      create: {
        business_id: mailbox.business_id,
        email: toEmail,
        name: toEmail.split('@')[0],
        source: 'DRAFT',
      },
    });

    let threadId = payload.thread_id;

    if (!threadId) {
      const thread = await this.prisma.emailThread.create({
        data: {
          business_id: mailbox.business_id,
          mailbox_id: mailbox.id,
          customer_id: customer.id,
          subject: payload.subject ?? '(no subject)',
          last_message_at: new Date(),
        },
      });
      threadId = thread.id;
    }

    // UPDATE existing draft
    if (payload.draft_id) {
      return this.prisma.email.update({
        where: { id: payload.draft_id },
        data: {
          subject: payload.subject,
          body_html: payload.html,
          body_text: cleanEmailText(
            htmlToText(payload.html, { wordwrap: false }),
          ),
        },
      });
    }

    // CREATE new draft
    return this.prisma.email.create({
      data: {
        business_id: mailbox.business_id,
        mailbox_id: mailbox.id,
        thread_id: threadId,
        from_address: mailbox.email_address,
        subject: payload.subject,
        body_html: payload.html,
        body_text: cleanEmailText(
          htmlToText(payload.html, { wordwrap: false }),
        ),
        folder: 'DRAFT',
      },
    });
  }
}
