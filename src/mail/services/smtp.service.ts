// import {
//   Injectable,
//   InternalServerErrorException,
//   Logger,
//   OnModuleDestroy,
// } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import { createSmtpTransporterFromDb } from 'src/config/smtp.config';
// import getNameFromEmail from 'src/config/getNameFromEmail';
// import { SocketService } from 'src/socket/socket.service';

// @Injectable()
// export class SmtpService implements OnModuleDestroy {
//   private logger = new Logger('SMTP');

//   constructor(
//     private prisma: PrismaService,
//     private socketService: SocketService,
//   ) {}

//   // 🔧 CHANGED: cache SMTP transporters per mailbox
//   private transporters = new Map<number, any>();

//   /* ================= SEND / REPLY / FORWARD ================= */
//   async sendMail(payload: {
//     mailbox_id: number;
//     to: string | string[];
//     cc?: string | string[];
//     bcc?: string | string[];
//     subject?: string;
//     text?: string; // TEXT ONLY
//     reply_message_id?: number;
//     forward_message_id?: number;
//     files?: Express.Multer.File[];
//   }) {
//     try {
//       /* ================= TO ================= */
//       const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
//       if (!toList.length) throw new Error('Recipient missing');

//       const customerEmail = toList[0].toLowerCase();

//       /* ================= MAILBOX ================= */
//       const mailbox = await this.prisma.mailbox.findUnique({
//         where: { id: payload.mailbox_id },
//       });

//       if (!mailbox) throw new Error('Mailbox not found');
//       if (!mailbox.smtp_host || !mailbox.smtp_port || !mailbox.smtp_password) {
//         throw new Error('SMTP config missing');
//       }

//       /* ================= CUSTOMER ================= */
//       const customerName = getNameFromEmail(customerEmail);

//       const customer = await this.prisma.customer.upsert({
//         where: {
//           business_email_unique: {
//             business_id: mailbox.business_id,
//             email: customerEmail,
//           },
//         },
//         update: { last_contact_at: new Date() },
//         create: {
//           business_id: mailbox.business_id,
//           email: customerEmail,
//           name: customerName,
//           source: 'OUTBOUND_EMAIL',
//           last_contact_at: new Date(),
//         },
//       });

//       /* ================= THREAD ================= */
//       let thread = await this.prisma.emailThread.findFirst({
//         where: {
//           mailbox_id: mailbox.id,
//           customer_id: customer.id,
//         },
//       });

//       if (!thread) {
//         thread = await this.prisma.emailThread.create({
//           data: {
//             business_id: mailbox.business_id,
//             mailbox_id: mailbox.id,
//             customer_id: customer.id,
//             subject: payload.subject ?? '(no subject)',
//             last_message_at: new Date(),
//           },
//         });
//       }

//       /* ================= SUBJECT + TEXT ================= */
//       let subject = payload.subject ?? '(no subject)';
//       let finalText =
//         typeof payload.text === 'string' ? payload.text.trim() : '';

//       /* ---------- REPLY ---------- */
//       if (payload.reply_message_id) {
//         const original = await this.prisma.email.findUnique({
//           where: { id: payload.reply_message_id },
//         });
//         if (!original) throw new Error('Reply email not found');

//         subject = original.subject?.startsWith('Re:')
//           ? original.subject
//           : `Re: ${original.subject}`;

//         finalText = `${finalText}

// -----------------------
// From: ${original.from_address}
// Subject: ${original.subject}

// ${original.body_text ?? ''}`;
//       }

//       /* ---------- FORWARD ---------- */
//       if (payload.forward_message_id) {
//         const original = await this.prisma.email.findUnique({
//           where: { id: payload.forward_message_id },
//         });
//         if (!original) throw new Error('Forward email not found');

//         subject = original.subject?.startsWith('Fwd:')
//           ? original.subject
//           : `Fwd: ${original.subject}`;

//         finalText = `${finalText}

// ---------- Forwarded message ----------
// From: ${original.from_address}
// Subject: ${original.subject}

// ${original.body_text ?? ''}`;
//       }

//       if (!finalText || !finalText.trim()) {
//         finalText = '(no message body)';
//       }

//       /* ================= SMTP TRANSPORTER ================= */
//       let transporter = this.transporters.get(mailbox.id);

//       if (!transporter) {
//         transporter = createSmtpTransporterFromDb({
//           smtp_host: mailbox.smtp_host,
//           smtp_port: mailbox.smtp_port,
//           smtp_password: mailbox.smtp_password,
//           email_address: mailbox.email_address,
//         });

//         this.transporters.set(mailbox.id, transporter);
//       }

//       const smtpAttachments =
//         payload.files?.map((file) => ({
//           filename: file.originalname,
//           path: file.path,
//           contentType: file.mimetype,
//         })) || [];

//       /* ================= SEND MAIL (WITH TIMEOUT) ================= */
//       const info: any = await Promise.race([
//         transporter.sendMail({
//           from: `"${mailbox.email_address}" <${mailbox.email_address}>`,
//           to: toList,
//           cc: payload.cc,
//           bcc: payload.bcc,
//           subject,
//           text: finalText,
//           attachments: smtpAttachments,
//         }),
//         new Promise((_, reject) =>
//           setTimeout(() => reject(new Error('SMTP timeout')), 15_000),
//         ),
//       ]);

//       /* ================= SAVE EMAIL ================= */
//       const email = await this.prisma.email.create({
//         data: {
//           business_id: mailbox.business_id,
//           mailbox_id: mailbox.id,
//           user_id: mailbox.user_id,
//           thread_id: thread.id,

//           subject,
//           from_address: mailbox.email_address,

//           to_addresses: [...toList],
//           cc_addresses: payload.cc
//             ? Array.isArray(payload.cc)
//               ? payload.cc
//               : [payload.cc]
//             : [],
//           bcc_addresses: payload.bcc
//             ? Array.isArray(payload.bcc)
//               ? payload.bcc
//               : [payload.bcc]
//             : [],

//           body_text: finalText,
//           // body_html: null,
//           folder: 'SENT',
//           sent_at: new Date(),
//           message_id: info.messageId,
//         },
//       });

//       /* ================= SAVE ATTACHMENTS ================= */
//       if (payload.files?.length) {
//         await this.prisma.emailAttachment.createMany({
//           data: payload.files.map((file) => ({
//             email_id: email.id,
//             file_name: file.originalname,
//             file_path: `/uploads/${
//               file.mimetype.startsWith('image/') ? 'images' : 'files'
//             }/${file.filename}`,
//             mime_type: file.mimetype,
//             file_size: file.size,
//           })),
//         });
//       }

//       /* ================= UPDATE THREAD ================= */
//       await this.prisma.emailThread.update({
//         where: { id: thread.id },
//         data: {
//           last_message_at: new Date(),
//           last_message_id: info.messageId,
//         },
//       });

//       /* ================= 🔔 SOCKET (SAFE) ================= */
//       try {
//         this.socketService.emit('email:sent', {
//           mailbox_id: mailbox.id,
//           thread_id: thread.id,
//           email_id: email.id,
//           subject: email.subject,
//           sent_at: email.sent_at,
//         });

//         this.socketService.emit('thread:updated', {
//           thread_id: thread.id,
//           last_message_at: new Date(),
//         });
//       } catch (e) {
//         this.logger.warn('Socket emit failed (ignored)');
//       }

//       return {
//         success: true,
//         messageId: info.messageId,
//         thread_id: thread.id,
//       };
//     } catch (err: any) {
//       throw new InternalServerErrorException(err.message);
//     }
//   }

//   /* ================= SAVE DRAFT ================= */
//   async saveDraft(payload: {
//     mailbox_id: number;
//     subject?: string;
//     text?: string;
//     files?: Express.Multer.File[];
//   }) {
//     const mailbox = await this.prisma.mailbox.findUnique({
//       where: { id: payload.mailbox_id },
//     });
//     if (!mailbox) throw new Error('Mailbox not found');

//     const bodyText =
//       typeof payload.text === 'string' && payload.text.trim()
//         ? payload.text.trim()
//         : '(no draft content)';

//     const draft = await this.prisma.email.create({
//       data: {
//         business_id: mailbox.business_id,
//         mailbox_id: mailbox.id,
//         user_id: mailbox.user_id,
//         subject: payload.subject ?? '(no subject)',
//         body_text: bodyText,
//         // body_html: null,
//         folder: 'DRAFT',
//       },
//     });

//     if (payload.files?.length) {
//       await this.prisma.emailAttachment.createMany({
//         data: payload.files.map((file) => ({
//           email_id: draft.id,
//           file_name: file.originalname,
//           file_path: `/uploads/${
//             file.mimetype.startsWith('image/') ? 'images' : 'files'
//           }/${file.filename}`,
//           mime_type: file.mimetype,
//           file_size: file.size,
//         })),
//       });
//     }

//     return draft;
//   }

//   /* ================= SHUTDOWN CLEANUP ================= */
//   async onModuleDestroy() {
//     for (const transporter of this.transporters.values()) {
//       try {
//         transporter.close?.();
//       } catch {}
//     }
//   }
// }

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { createSmtpTransporterFromDb } from 'src/config/smtp.config';
import getNameFromEmail from 'src/config/getNameFromEmail';
import { SocketService } from 'src/socket/socket.service';

@Injectable()
export class SmtpService implements OnModuleDestroy {
  private logger = new Logger('SMTP');

  constructor(
    private prisma: PrismaService,
    private socketService: SocketService,
  ) {}

  // cache SMTP transporters per mailbox
  private transporters = new Map<number, any>();

  /* ================= SEND / REPLY / FORWARD ================= */
  async sendMail(payload: {
    mailbox_id: number;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    reply_message_id?: number;
    forward_message_id?: number;
    draft_id?: number; // ✅ NEW
    files?: Express.Multer.File[];
  }) {
    try {
      /* ================= TO ================= */
      const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
      if (!toList.length) throw new Error('Recipient missing');

      const customerEmail = toList[0].toLowerCase();

      /* ================= MAILBOX ================= */
      const mailbox = await this.prisma.mailbox.findUnique({
        where: { id: payload.mailbox_id },
      });
      if (!mailbox) throw new Error('Mailbox not found');

      /* ================= DRAFT LOAD ================= */
      let draftEmail: any = null;

      if (payload.draft_id) {
        draftEmail = await this.prisma.email.findUnique({
          where: { id: payload.draft_id },
        });
        if (!draftEmail) throw new Error('Draft not found');

        payload.subject ??= draftEmail.subject;
        payload.text ??= draftEmail.body_text ?? '';
      }

      /* ================= SMTP CHECK ================= */
      if (!mailbox.smtp_host || !mailbox.smtp_port || !mailbox.smtp_password) {
        return { success: false, error: 'SMTP config missing' };
      }

      /* ================= CUSTOMER ================= */
      const customer = await this.prisma.customer.upsert({
        where: {
          business_email_unique: {
            business_id: mailbox.business_id,
            email: customerEmail,
          },
        },
        update: { last_contact_at: new Date() },
        create: {
          business_id: mailbox.business_id,
          email: customerEmail,
          name: getNameFromEmail(customerEmail),
          source: 'OUTBOUND_EMAIL',
          last_contact_at: new Date(),
        },
      });

      /* ================= THREAD ================= */
      let thread = await this.prisma.emailThread.findFirst({
        where: { mailbox_id: mailbox.id, customer_id: customer.id },
      });

      if (!thread) {
        thread = await this.prisma.emailThread.create({
          data: {
            business_id: mailbox.business_id,
            mailbox_id: mailbox.id,
            customer_id: customer.id,
            subject: payload.subject ?? '(no subject)',
            last_message_at: new Date(),
          },
        });
      }

      /* ================= SUBJECT + BODY ================= */
      let subject = payload.subject ?? '(no subject)';
      let finalText = payload.text?.trim() || '(no message body)';

      /* ---------- REPLY ---------- */
      if (payload.reply_message_id) {
        const original = await this.prisma.email.findUnique({
          where: { id: payload.reply_message_id },
        });
        if (!original) throw new Error('Reply email not found');

        subject = original.subject?.startsWith('Re:')
          ? original.subject
          : `Re: ${original.subject}`;

        finalText += `

-----------------------
From: ${original.from_address}
Subject: ${original.subject}

${original.body_text ?? ''}`;
      }

      /* ---------- FORWARD ---------- */
      if (payload.forward_message_id) {
        const original = await this.prisma.email.findUnique({
          where: { id: payload.forward_message_id },
        });
        if (!original) throw new Error('Forward email not found');

        subject = original.subject?.startsWith('Fwd:')
          ? original.subject
          : `Fwd: ${original.subject}`;

        finalText += `

---------- Forwarded message ----------
From: ${original.from_address}
Subject: ${original.subject}

${original.body_text ?? ''}`;
      }

      /* ================= SMTP SEND ================= */
      let transporter = this.transporters.get(mailbox.id);
      if (!transporter) {
        transporter = createSmtpTransporterFromDb({
          smtp_host: mailbox.smtp_host,
          smtp_port: mailbox.smtp_port,
          smtp_password: mailbox.smtp_password,
          email_address: mailbox.email_address,
        });
        this.transporters.set(mailbox.id, transporter);
      }

      const info: any = await Promise.race([
        transporter.sendMail({
          from: `"${mailbox.email_address}" <${mailbox.email_address}>`,
          to: toList,
          cc: payload.cc,
          bcc: payload.bcc,
          subject,
          text: finalText,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SMTP timeout')), 15000),
        ),
      ]);

      /* ================= SAVE EMAIL ================= */
      let email;

      if (draftEmail) {
        // ✅ DRAFT → SENT
        email = await this.prisma.email.update({
          where: { id: draftEmail.id },
          data: {
            subject,
            body_text: finalText,
            folder: 'SENT',
            sent_at: new Date(),
            message_id: info.messageId,
          },
        });
      } else {
        // ✅ NORMAL SEND
        email = await this.prisma.email.create({
          data: {
            business_id: mailbox.business_id,
            mailbox_id: mailbox.id,
            user_id: mailbox.user_id,
            thread_id: thread.id,
            subject,
            from_address: mailbox.email_address,
            to_addresses: toList,
            cc_addresses: payload.cc
              ? Array.isArray(payload.cc)
                ? payload.cc
                : [payload.cc]
              : [],
            bcc_addresses: payload.bcc
              ? Array.isArray(payload.bcc)
                ? payload.bcc
                : [payload.bcc]
              : [],
            body_text: finalText,
            folder: 'SENT',
            sent_at: new Date(),
            message_id: info.messageId,
          },
        });
      }

      /* ================= THREAD UPDATE ================= */
      await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          last_message_at: new Date(),
          last_message_id: info.messageId,
        },
      });

      /* ================= SOCKET ================= */
      this.socketService.emit('email:sent', {
        mailbox_id: mailbox.id,
        thread_id: thread.id,
        email_id: email.id,
      });

      return {
        success: true,
        messageId: info.messageId,
        thread_id: thread.id,
      };
    } catch (err: any) {
      this.logger.error('sendMail failed', err.message);
      throw new InternalServerErrorException(err.message);
    }
  }

  /* ================= SAVE DRAFT ================= */
  async saveDraft(payload: {
    mailbox_id: number;
    subject?: string;
    text?: string;
    draft_id?: number; // ✅ autosave support
    files?: Express.Multer.File[];
  }) {
    /* ================= MAILBOX ================= */
    const mailbox = await this.prisma.mailbox.findUnique({
      where: { id: payload.mailbox_id },
    });

    if (!mailbox) {
      throw new Error('Mailbox not found');
    }

    const bodyText =
      typeof payload.text === 'string' && payload.text.trim()
        ? payload.text.trim()
        : '(no draft content)';

    /* ================= CREATE / UPDATE DRAFT ================= */
    let draft;

    if (payload.draft_id) {
      // ✅ UPDATE EXISTING DRAFT (autosave)
      draft = await this.prisma.email.update({
        where: { id: payload.draft_id },
        data: {
          subject: payload.subject ?? '(no subject)',
          body_text: bodyText,
        },
      });

      // 🔥 Remove old attachments (important)
      await this.prisma.emailAttachment.deleteMany({
        where: { email_id: draft.id },
      });
    } else {
      // ✅ CREATE NEW DRAFT
      draft = await this.prisma.email.create({
        data: {
          business_id: mailbox.business_id,
          mailbox_id: mailbox.id,
          user_id: mailbox.user_id,
          subject: payload.subject ?? '(no subject)',
          body_text: bodyText,
          folder: 'DRAFT',
        },
      });
    }

    /* ================= ATTACHMENTS ================= */
    if (payload.files?.length) {
      await this.prisma.emailAttachment.createMany({
        data: payload.files.map((file) => ({
          email_id: draft.id,
          file_name: file.originalname,
          file_path: `/uploads/${
            file.mimetype.startsWith('image/') ? 'images' : 'files'
          }/${file.filename}`,
          mime_type: file.mimetype,
          file_size: file.size,
        })),
      });
    }

    return {
      success: true,
      draft_id: draft.id,
      subject: draft.subject,
      body_text: draft.body_text,
    };
  }

  /* ================= SHUTDOWN CLEANUP ================= */
  async onModuleDestroy() {
    for (const transporter of this.transporters.values()) {
      try {
        transporter.close?.();
      } catch {}
    }
  }
}
