
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

@Injectable()
export class ImapSyncService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('IMAP-SYNC');
  private clients = new Map<number, ImapFlow>();
  private syncing = new Set<number>();

  // ⏱️ cooldown tracker (cron / reconnect only)
  private lastSyncAt = new Map<number, number>();

  constructor(private prisma: PrismaService) {}

  /* ===============================
     APP LIFECYCLE
  =============================== */

  async onModuleInit() {
    this.logger.log('🚀 IMAP Sync Engine Started');

    try {
      const mailboxes = await this.prisma.mailbox.findMany();
      for (const box of mailboxes) {
        await this.startMailbox(box);
      }
    } catch (err: any) {
      this.logger.error('❌ IMAP init failed', err.message);
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
    try {
      if (!box.imap_password) {
        this.logger.error(`❌ Missing IMAP password → ${box.email_address}`);
        return;
      }

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

      // 🔥 EXISTS = new mail → force sync (NO cooldown)
      client.on('exists', () => {
        setTimeout(() => {
          this.syncInbox(box.id, true).catch(() => null);
        }, 1500);
      });

      client.on('error', (err) => {
        this.logger.error(`❌ IMAP error → ${box.email_address}`, err.message);
        this.reconnect(box);
      });

      client.on('close', () => this.reconnect(box));

      await client.connect();
      await client.mailboxOpen('INBOX');

      this.clients.set(box.id, client);

      // 🔥 initial sync (force)
      await this.syncInbox(box.id, true).catch(() => null);

      this.logger.log(`✅ IMAP Connected → ${box.email_address}`);
    } catch (err: any) {
      this.logger.error(
        `❌ IMAP connect failed → ${box.email_address}`,
        err.message,
      );
      this.reconnect(box);
    }
  }

  private reconnect(box: any) {
    this.logger.warn(`🔁 Reconnecting IMAP → ${box.email_address}`);
    setTimeout(() => {
      this.startMailbox(box).catch(() => null);
    }, 30000);
  }

  /* ===============================
     HEALTH CHECK (FALLBACK)
  =============================== */

  @Cron(CronExpression.EVERY_30_SECONDS)
  async ensureHealthyConnections() {
    try {
      const mailboxes = await this.prisma.mailbox.findMany();

      for (const box of mailboxes) {
        const client = this.clients.get(box.id);

        if (!client || !client.usable) {
          await this.startMailbox(box);
        } else {
          // 🔥 fallback sync (non-force → cooldown applies)
          await this.syncInbox(box.id);
        }
      }
    } catch (err: any) {
      this.logger.error('❌ IMAP health check failed', err.message);
    }
  }

  /* ===============================
     SYNC INBOX
  =============================== */

  async syncInbox(mailbox_id: number, force = false) {
    // ⏱️ cooldown ONLY when not forced
    const now = Date.now();
    const last = this.lastSyncAt.get(mailbox_id) || 0;

    if (!force && now - last < 20_000) {
      return;
    }

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
      if (!status.messages) return;

      // 🔹 Always scan last 10 messages
      const start = Math.max(status.messages - 9, 1);
      const range = `${start}:${status.messages}`;

      let count = 0;

      for await (const msg of client.fetch(range, {
        uid: true,
        source: true,
        envelope: true,
      })) {
        if (count >= 10) break;
        count++;

        try {
          await this.processEmail(box, msg);
        } catch (err: any) {
          this.logger.error(
            `❌ processEmail failed → mailbox ${box.id}`,
            err.message,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `❌ Sync inbox failed → mailbox ${mailbox_id}`,
        err.message,
      );
    } finally {
      this.syncing.delete(mailbox_id);
    }
  }

  /* ===============================
     PROCESS EMAIL (INBOUND)
  =============================== */

  private async processEmail(box: any, msg: any) {
    try {
      const uid = Number(msg.uid);
      if (!uid) return;

      // 🔐 prevent duplicate save
      const exists = await this.prisma.email.findFirst({
        where: { mailbox_id: box.id, imap_uid: uid },
      });
      if (exists) return;

      const parsed = await simpleParser(msg.source);
      const from = parsed.from?.value?.[0]?.address?.toLowerCase();
      // if (!from || !isProfessionalHumanEmail(from)) return;
      if (!from) return;

      const { isHuman, reason } = isProfessionalHumanEmail(from);

      // ⛔ obvious promo / system mail skip (like your example)
      if (!isHuman) {
        this.logger.warn(`⛔ Skipped system mail → ${from} (${reason})`);
        return;
      }

      const subject = parsed.subject || '(no subject)';

      const rawHtml =
        typeof parsed.html === 'string'
          ? parsed.html
          : parsed.html?.toString() || '';

      const rawText =
        htmlToText(rawHtml, { wordwrap: false }) || parsed.text || '';

      const body_text = cleanEmailText(rawText) || '(no content)';
      const body_html = rawHtml || `<p>${body_text}</p>`;

      /* CUSTOMER */
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
          name: from,
          source: 'INBOUND_EMAIL',
          last_contact_at: new Date(),
        },
      });

      /* THREAD */
      let thread = await this.prisma.emailThread.findFirst({
        where: { mailbox_id: box.id, customer_id: customer.id },
        orderBy: { last_message_at: 'desc' },
      });

      if (!thread) {
        thread = await this.prisma.emailThread.create({
          data: {
            business_id: box.business_id,
            mailbox_id: box.id,
            customer_id: customer.id,
            subject,
            last_message_at: new Date(),
            last_message_id: parsed.messageId,
            references: normalizeReferences(parsed.references),
          },
        });
      } else {
        await this.prisma.emailThread.update({
          where: { id: thread.id },
          data: {
            last_message_at: new Date(),
            last_message_id: parsed.messageId,
            references:
              normalizeReferences(parsed.references) || thread.references,
          },
        });
      }

      /* SAVE EMAIL */
      await this.prisma.email.create({
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

      this.logger.log(`📩 IMAP saved → ${from}`);
    } catch (err: any) {
      this.logger.error(
        `❌ processEmail failed → mailbox ${box.id}`,
        err.message,
      );
    }
  }
}
