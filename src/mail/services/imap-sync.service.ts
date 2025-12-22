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

@Injectable()
export class ImapSyncService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('IMAP-SYNC');
  private clients = new Map<number, ImapFlow>();
  private syncing = new Set<number>();
  private lastSyncAt = new Map<number, number>();

  constructor(private prisma: PrismaService) {}

  /* ===============================
     PATHS (SAME AS MULTER CONFIG)
  =============================== */
  private uploadRoot = join(process.cwd(), 'uploads');
  private imageDir = join(this.uploadRoot, 'images');
  private fileDir = join(this.uploadRoot, 'files');

  /* ===============================
     APP LIFECYCLE
  =============================== */

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

  /* ===============================
     MAILBOX CONNECT
  =============================== */

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
      setTimeout(() => this.syncInbox(box.id, true).catch(() => null), 1500);
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
    setTimeout(() => this.startMailbox(box).catch(() => null), 30000);
  }

  /* ===============================
     HEALTH CHECK
  =============================== */

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

  /* ===============================
     SYNC INBOX
  =============================== */

  async syncInbox(mailbox_id: number, force = false) {
    const now = Date.now();
    const last = this.lastSyncAt.get(mailbox_id) || 0;
    if (!force && now - last < 20_000) return;

    this.lastSyncAt.set(mailbox_id, now);
    if (this.syncing.has(mailbox_id)) return;
    this.syncing.add(mailbox_id);

    try {
      const box = await this.prisma.mailbox.findUnique({
        where: { id: mailbox_id },
      });
      const client = this.clients.get(mailbox_id);
      if (!box || !client) return;

      const status = await client.status('INBOX', { messages: true });
      const start = Math.max(status.messages! - 9, 1);

      for await (const msg of client.fetch(`${start}:${status.messages}`, {
        uid: true,
        source: true,
      })) {
        await this.processEmail(box, msg);
      }
    } finally {
      this.syncing.delete(mailbox_id);
    }
  }

  /* ===============================
     PROCESS EMAIL (INBOUND)
  =============================== */

  private async processEmail(box: any, msg: any) {
    const uid = Number(msg.uid);
    if (!uid) return;

    const exists = await this.prisma.email.findFirst({
      where: { mailbox_id: box.id, imap_uid: uid },
    });
    if (exists) return;

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
    const body_text = cleanEmailText(
      htmlToText(rawHtml, { wordwrap: false }) || parsed.text || '',
    );
    const body_html = rawHtml || `<p>${body_text}</p>`;

    /* CUSTOMER */
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

    /* THREAD (ONE CUSTOMER = ONE THREAD) */
    let thread = await this.prisma.emailThread.findFirst({
      where: { mailbox_id: box.id, customer_id: customer.id },
    });

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

    /* SAVE EMAIL */
    const email = await this.prisma.email.create({
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
        body_html,
        body_text,
        folder: 'INBOX',
        received_at: new Date(),
      },
    });

    /* ================= SAVE ATTACHMENTS (IMAP) ================= */
    if (parsed.attachments?.length) {
      const attachmentData: Prisma.EmailAttachmentCreateManyInput[] = [];

      for (const att of parsed.attachments) {
        const isImage = att.contentType?.startsWith('image/');
        const dir = isImage ? this.imageDir : this.fileDir;

        const ext = extname(att.filename || '');
        const filename =
          Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;

        fs.writeFileSync(join(dir, filename), att.content);

        attachmentData.push({
          email_id: email.id,
          file_name: att.filename || filename,
          file_path: `/uploads/${isImage ? 'images' : 'files'}/${filename}`,
          mime_type: att.contentType || 'application/octet-stream',
          file_size: att.size ?? null,
        });
      }

      if (attachmentData.length) {
        await this.prisma.emailAttachment.createMany({
          data: attachmentData,
        });
      }
    }

    /* UPDATE THREAD */
    await this.prisma.emailThread.update({
      where: { id: thread.id },
      data: {
        last_message_at: new Date(),
        last_message_id: parsed.messageId,
      },
    });

    this.logger.log(`📩 IMAP saved → ${from}`);
  }
}
