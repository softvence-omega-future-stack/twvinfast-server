// import {
//   Injectable,
//   Logger,
//   OnModuleInit,
//   OnModuleDestroy,
// } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import { ImapFlow } from 'imapflow';
// import { simpleParser } from 'mailparser';
// import { htmlToText } from 'html-to-text';
// import { cleanEmailText } from '../../common/utils/clean-email-text';
// import { isProfessionalHumanEmail } from '../utils/email-filter';
// import { normalizeReferences } from 'src/common/utils/normalizeReferences';
// import { Prisma } from '@prisma/client';

// import * as fs from 'fs';
// import { join, extname } from 'path';
// import getNameFromEmail from 'src/config/getNameFromEmail';
// import { SocketService } from 'src/socket/socket.service'; // ✅ ADDED

// @Injectable()
// export class ImapSyncService implements OnModuleInit, OnModuleDestroy {
//   private logger = new Logger('IMAP-SYNC');
//   private clients = new Map<number, ImapFlow>();
//   private syncing = new Set<number>(); // ✅ already correct
//   private lastSyncAt = new Map<number, number>();

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly socket: SocketService, // ✅ ADDED (emit only)
//   ) {}

//   /* ===============================
//      APP INIT
//   =============================== */

//   async onModuleInit() {
//     this.logger.log('🚀 IMAP Sync Engine Started');

//     const mailboxes = await this.prisma.mailbox.findMany();
//     for (const box of mailboxes) {
//       await this.startMailbox(box);
//     }
//   }

//   async onModuleDestroy() {
//     for (const client of this.clients.values()) {
//       await client.logout().catch(() => null);
//     }
//   }

//   /* ===============================
//      CONNECT MAILBOX
//   =============================== */

//   private async startMailbox(box: any) {
//     if (!box.imap_password) return;

//     const client = new ImapFlow({
//       host: box.imap_host,
//       port: box.imap_port,
//       secure: true,
//       auth: {
//         user: box.email_address,
//         pass: box.imap_password,
//       },
//       tls: { rejectUnauthorized: false },
//     });

//     client.on('exists', () => {
//       // ✅ SAFE: IMAP → DB → SOCKET
//       setTimeout(() => this.syncInbox(box.id, true), 1500);
//     });

//     client.on('error', () => this.reconnect(box));
//     client.on('close', () => this.reconnect(box));

//     await client.connect();
//     await client.mailboxOpen('INBOX');

//     this.clients.set(box.id, client);
//     await this.syncInbox(box.id, true);

//     this.logger.log(`✅ IMAP Connected → ${box.email_address}`);
//   }

//   private reconnect(box: any) {
//     setTimeout(() => this.startMailbox(box).catch(() => null), 30_000);
//   }

//   /* ===============================
//      HEALTH CHECK (ONLY IMAP)
//   =============================== */

//   @Cron(CronExpression.EVERY_30_SECONDS)
//   async ensureHealthyConnections() {
//     const mailboxes = await this.prisma.mailbox.findMany();

//     for (const box of mailboxes) {
//       const client = this.clients.get(box.id);

//       if (!client || !client.usable) {
//         await this.startMailbox(box);
//       } else {
//         await this.syncInbox(box.id);
//       }
//     }
//   }

//   /* ===============================
//      SYNC INBOX (LOCKED)
//   =============================== */

//   async syncInbox(mailboxId: number, force = false) {
//     const now = Date.now();
//     const last = this.lastSyncAt.get(mailboxId) || 0;

//     if (!force && now - last < 20_000) return;
//     if (this.syncing.has(mailboxId)) return;

//     this.lastSyncAt.set(mailboxId, now);
//     this.syncing.add(mailboxId); // ✅ LOCK

//     try {
//       const box = await this.prisma.mailbox.findUnique({
//         where: { id: mailboxId },
//       });

//       const client = this.clients.get(mailboxId);
//       if (!box || !client) return;

//       const status = await client.status('INBOX', { messages: true });
//       const start = Math.max((status.messages ?? 1) - 9, 1);

//       for await (const msg of client.fetch(`${start}:${status.messages}`, {
//         uid: true,
//         source: true,
//       })) {
//         await this.processEmail(box, msg);
//       }
//     } finally {
//       this.syncing.delete(mailboxId); // ✅ UNLOCK
//     }
//   }

//   /* ===============================
//      PROCESS EMAIL
//   =============================== */

//   private async processEmail(box: any, msg: any) {
//     const uid = Number(msg.uid);
//     if (!uid) return;

//     const exists = await this.prisma.email.findFirst({
//       where: { mailbox_id: box.id, imap_uid: uid },
//     });
//     if (exists) return;

//     const parsed = await simpleParser(msg.source);
//     const from = parsed.from?.value?.[0]?.address?.toLowerCase();
//     if (!from) return;

//     const { isHuman } = isProfessionalHumanEmail(from);
//     if (!isHuman) return;

//     const subject = parsed.subject || '(no subject)';
//     const rawHtml =
//       typeof parsed.html === 'string'
//         ? parsed.html
//         : parsed.html?.toString() || '';

//     const body_text = cleanEmailText(
//       htmlToText(rawHtml, { wordwrap: false }) || parsed.text || '',
//     );

//     const body_html = rawHtml || `<p>${body_text}</p>`;

//     /* ================= SAVE CUSTOMER ================= */

//     const senderName = parsed.from?.value?.[0]?.name || getNameFromEmail(from);

//     const customer = await this.prisma.customer.upsert({
//       where: {
//         business_email_unique: {
//           business_id: box.business_id,
//           email: from,
//         },
//       },
//       update: { last_contact_at: new Date() },
//       create: {
//         business_id: box.business_id,
//         email: from,
//         name: senderName,
//         source: 'INBOUND_EMAIL',
//         last_contact_at: new Date(),
//       },
//     });

//     /* ================= THREAD ================= */

//     let thread = await this.prisma.emailThread.findFirst({
//       where: { mailbox_id: box.id, customer_id: customer.id },
//     });

//     if (!thread) {
//       thread = await this.prisma.emailThread.create({
//         data: {
//           business_id: box.business_id,
//           mailbox_id: box.id,
//           customer_id: customer.id,
//           subject,
//           last_message_at: new Date(),
//         },
//       });
//     }

//     /* ================= SAVE EMAIL ================= */

//     const email = await this.prisma.email.create({
//       data: {
//         business_id: box.business_id,
//         user_id: box.user_id,
//         mailbox_id: box.id,
//         thread_id: thread.id,
//         imap_uid: uid,
//         message_id: parsed.messageId,
//         in_reply_to: parsed.inReplyTo,
//         references: normalizeReferences(parsed.references),
//         from_address: from,
//         subject,
//         body_html,
//         body_text,
//         folder: 'INBOX',
//         received_at: new Date(),
//       },
//     });

//     /* ================= SOCKET EMIT ================= */
//     // ✅ CHANGED: ONLY EMIT (NO LOGIC)
//     this.socket.emitToMailbox(box.id, 'email:new', {
//       mailbox_id: box.id,
//       thread_id: thread.id,
//       email_id: email.id,
//       from,
//       subject,
//       snippet: body_text.slice(0, 120),
//       received_at: email.received_at,
//     });

//     this.logger.log(`📩 IMAP saved → ${from}`);
//   }
// }
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { htmlToText } from 'html-to-text';
import { cleanEmailText } from '../../common/utils/clean-email-text';
import { isProfessionalHumanEmail } from '../utils/email-filter';
import { normalizeReferences } from 'src/common/utils/normalizeReferences';
import { Prisma } from '@prisma/client';

import * as fs from 'fs';
import { join, extname } from 'path';
import getNameFromEmail from 'src/config/getNameFromEmail';
import { SocketService } from 'src/socket/socket.service';

/* ===============================
   🔧 SIGNATURE STRIPPER (ADDED)
   ONLY USED FOR body_text
=============================== */
function stripSignature(text: string): string {
  const patterns = [
    /\n--\s*\n[\s\S]*$/i,
    /\nRegards[\s\S]*$/i,
    /\nBest regards[\s\S]*$/i,
    /\nThanks[\s\S]*$/i,
    /\nThank you[\s\S]*$/i,
    /\nSincerely[\s\S]*$/i,
  ];

  for (const p of patterns) {
    if (p.test(text)) {
      return text.replace(p, '').trim();
    }
  }

  return text.trim();
}

@Injectable()
export class ImapSyncService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('IMAP-SYNC');
  private clients = new Map<number, ImapFlow>();
  private syncing = new Set<number>();
  private lastSyncAt = new Map<number, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketService,
  ) {}

  /* ================= APP INIT ================= */

  async onModuleInit() {
    this.logger.log('🚀 IMAP Sync Engine Started');

    const mailboxes = await this.prisma.mailbox.findMany();
    for (const box of mailboxes) {
      await this.startMailbox(box);
    }
  }

  async onModuleDestroy() {
    for (const client of this.clients.values()) {
      await client.logout().catch(() => null);
    }
  }

  /* ================= CONNECT MAILBOX ================= */

  private async startMailbox(box: any) {
    if (!box.imap_password) return;

    const client = new ImapFlow({
      host: box.imap_host,
      port: box.imap_port,
      secure: true,
      auth: {
        user: box.email_address,
        pass: box.imap_password,
      },
      tls: { rejectUnauthorized: false },
    });

    client.on('exists', () => {
      setTimeout(() => this.syncInbox(box.id, true), 1500);
    });

    client.on('error', () => this.reconnect(box));
    client.on('close', () => this.reconnect(box));

    await client.connect();
    await client.mailboxOpen('INBOX');

    this.clients.set(box.id, client);
    await this.syncInbox(box.id, true);

    this.logger.log(`✅ IMAP Connected → ${box.email_address}`);
  }

  private reconnect(box: any) {
    setTimeout(() => this.startMailbox(box).catch(() => null), 30_000);
  }

  /* ================= HEALTH CHECK ================= */

  @Cron(CronExpression.EVERY_30_SECONDS)
  async ensureHealthyConnections() {
    const mailboxes = await this.prisma.mailbox.findMany();

    for (const box of mailboxes) {
      const client = this.clients.get(box.id);
      if (!client || !client.usable) {
        await this.startMailbox(box);
      } else {
        await this.syncInbox(box.id);
      }
    }
  }

  /* ================= SYNC INBOX ================= */

  async syncInbox(mailboxId: number, force = false) {
    const now = Date.now();
    const last = this.lastSyncAt.get(mailboxId) || 0;

    if (!force && now - last < 20_000) return;
    if (this.syncing.has(mailboxId)) return;

    this.lastSyncAt.set(mailboxId, now);
    this.syncing.add(mailboxId);

    try {
      const box = await this.prisma.mailbox.findUnique({
        where: { id: mailboxId },
      });

      const client = this.clients.get(mailboxId);
      if (!box || !client) return;

      const status = await client.status('INBOX', { messages: true });
      const start = Math.max((status.messages ?? 1) - 9, 1);

      for await (const msg of client.fetch(`${start}:${status.messages}`, {
        uid: true,
        source: true,
      })) {
        await this.processEmail(box, msg);
      }
    } finally {
      this.syncing.delete(mailboxId);
    }
  }

  /* ================= PROCESS EMAIL ================= */

  private async processEmail(box: any, msg: any) {
    const uid = Number(msg.uid);
    if (!uid) return;

    const parsed = await simpleParser(msg.source);
    const from = parsed.from?.value?.[0]?.address?.toLowerCase();
    if (!from) return;

    const { isHuman } = isProfessionalHumanEmail(from);
    if (!isHuman) return;

    const subject = parsed.subject || '(no subject)';
    const rawHtml =
      typeof parsed.html === 'string'
        ? parsed.html
        : parsed.html?.toString() || '';

    /* ================= body_text FIX (ONLY CHANGE) ================= */

    let text =
      htmlToText(rawHtml, {
        wordwrap: false,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'a', options: { ignoreHref: true } },
        ],
      }) ||
      parsed.text ||
      '';

    text = cleanEmailText(text);
    text = stripSignature(text);

    const body_text = text;
    // const body_html = rawHtml || `<p>${body_text}</p>`;

    /* ================= CUSTOMER ================= */

    const senderName = parsed.from?.value?.[0]?.name || getNameFromEmail(from);

    const customer = await this.prisma.customer.upsert({
      where: {
        business_email_unique: {
          business_id: box.business_id,
          email: from,
        },
      },
      update: { last_contact_at: new Date() },
      create: {
        business_id: box.business_id,
        email: from,
        name: senderName,
        source: 'INBOUND_EMAIL',
        last_contact_at: new Date(),
      },
    });

    /* ================= THREAD ================= */

    let thread = await this.prisma.emailThread.findFirst({
      where: { mailbox_id: box.id, customer_id: customer.id },
    });

    if (thread) {
      // ✅ ADDED: SAME THREAD LOG (as requested)
      console.log(`📨 Same thread mail received → thread_id=${thread.id}`);
    }

    if (!thread) {
      thread = await this.prisma.emailThread.create({
        data: {
          business_id: box.business_id,
          mailbox_id: box.id,
          customer_id: customer.id,
          subject,
          last_message_at: new Date(),
        },
      });
    }

    /* ================= SAVE EMAIL ================= */

    let email;
    try {
      email = await this.prisma.email.create({
        data: {
          business_id: box.business_id,
          user_id: box.user_id,
          mailbox_id: box.id,
          thread_id: thread.id,
          imap_uid: uid,
          message_id: parsed.messageId,
          in_reply_to: parsed.inReplyTo,
          references: normalizeReferences(parsed.references),
          from_address: from,
          subject,
          // body_html,
          body_text,
          folder: 'INBOX',
          received_at: new Date(),
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        return;
      }
      throw e;
    }

    /* ================= SOCKET EMIT ================= */

    this.socket.emitToMailbox(box.id, 'email:new', {
      mailbox_id: box.id,
      thread_id: thread.id,
      email_id: email.id,
      from,
      subject,
      snippet: body_text.slice(0, 120),
      received_at: email.received_at,
    });

    this.logger.log(`📩 IMAP saved → ${from}`);
  }
}
