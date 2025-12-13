import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { isProfessionalHumanEmail } from '../utils/email-filter';

@Injectable()
export class ImapSyncService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('IMAP-SYNC');
  private clients: Map<number, ImapFlow> = new Map();
  private syncing = new Set<number>(); // 🔒 sync lock

  constructor(private prisma: PrismaService) {}

  /* ===============================
     APP LIFECYCLE
  =============================== */

  async onModuleInit() {
    this.logger.log('🚀 IMAP Sync Engine Started');
    await this.loadMailboxes();
  }

  async onModuleDestroy() {
    for (const client of this.clients.values()) {
      await client.logout().catch(() => null);
    }
  }

  /* ===============================
     MAILBOX BOOTSTRAP
  =============================== */

  private async loadMailboxes() {
    const mailboxes = await this.prisma.mailbox.findMany();
    for (const box of mailboxes) {
      await this.startMailbox(box);
    }
  }

  private async startMailbox(box: any) {
    if (!box.imap_password) {
      this.logger.error(`❌ Missing IMAP password → ${box.email_address}`);
      return;
    }

    const client = new ImapFlow({
      host: box.imap_host,
      port: box.imap_port,
      secure: box.is_ssl ?? true,
      auth: {
        user: box.email_address,
        pass: box.imap_password, // Gmail → App Password
      },
      logger: false,
      connectionTimeout: 20000,
      tls: { rejectUnauthorized: false },
    });

    client.on('exists', () => {
      this.logger.debug(`📥 New mail detected → ${box.email_address}`);
      this.syncInbox(box.id);
    });

    client.on('error', (err) => {
      this.logger.error(
        `❌ IMAP error → ${box.email_address} | ${err?.message || err}`,
      );
      this.reconnect(box);
    });

    client.on('close', () => {
      this.logger.warn(`⚠️ IMAP closed → ${box.email_address}`);
      this.reconnect(box);
    });

    try {
      await client.connect();
      await client.mailboxOpen('INBOX');

      this.clients.set(box.id, client);
      await this.syncInbox(box.id);

      this.logger.log(`✅ IMAP Connected → ${box.email_address}`);
    } catch (err) {
      this.logger.error(`❌ IMAP connection failed → ${box.email_address}`);
      this.logger.error(err?.message || err);
      this.reconnect(box);
    }
  }

  private reconnect(box: any) {
    this.logger.warn(`🔁 Reconnecting in 30s → ${box.email_address}`);
    setTimeout(() => this.startMailbox(box), 30000);
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
        this.logger.warn(`🛑 Restarting IMAP → ${box.email_address}`);
        await this.startMailbox(box);
      }
    }
  }

  /* ===============================
     MAIN SYNC (LAST 10 ONLY)
  =============================== */

  async syncInbox(mailbox_id: number) {
    if (this.syncing.has(mailbox_id)) return;
    this.syncing.add(mailbox_id);

    try {
      const box = await this.prisma.mailbox.findUnique({
        where: { id: mailbox_id },
      });
      if (!box) return;

      const client = this.clients.get(mailbox_id);
      if (!client?.usable) return;

      await client.mailboxOpen('INBOX');

      const status = await client.status('INBOX', { messages: true });
      const total = status.messages || 0;
      if (total === 0) return;

      const start = Math.max(total - 9, 1);
      const range = `${start}:${total}`;

      const messages = await client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
      });

      for await (const msg of messages) {
        await this.processEmail(box, msg);
      }
    } finally {
      this.syncing.delete(mailbox_id);
    }
  }

  /* ===============================
     PROCESS SINGLE EMAIL
  =============================== */

  private async processEmail(box: any, msg: any) {
    const uid = msg.uid;
    if (!uid) return;

    // 🔒 UID BASED DEDUP
    const exists = await this.prisma.email.findFirst({
      where: {
        mailbox_id: box.id,
        imap_uid: uid,
      },
    });
    if (exists) return;

    const fromObj = msg.envelope.from?.[0];
    const fromEmail = fromObj?.address?.toLowerCase();
    const fromName = fromObj?.name ?? 'Unknown';

    if (!fromEmail || !isProfessionalHumanEmail(fromEmail)) return;

    // 👤 Customer
    const customer = await this.prisma.customer.upsert({
      where: {
        business_email_unique: {
          business_id: box.business_id,
          email: fromEmail,
        },
      },
      update: { last_contact_at: new Date() },
      create: {
        business_id: box.business_id,
        email: fromEmail,
        name: fromName,
        source: 'INBOUND_EMAIL',
        last_contact_at: new Date(),
      },
    });

    const subject = msg.envelope.subject ?? '(no subject)';
    const bodyHtml = msg.source.toString();

    let thread = await this.prisma.emailThread.findFirst({
      where: {
        mailbox_id: box.id,
        customer_id: customer.id,
        subject,
      },
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
    } else {
      await this.prisma.emailThread.update({
        where: { id: thread.id },
        data: { last_message_at: new Date() },
      });
    }

    // 📩 SAVE EMAIL (NO message_id)
    await this.prisma.email.create({
      data: {
        business_id: box.business_id,
        mailbox_id: box.id,
        thread_id: thread.id,

        imap_uid: uid,
        from_address: fromEmail,
        subject,
        body_html: bodyHtml,
        folder: 'INBOX',
        received_at: new Date(),
      },
    });

    this.logger.log(`✅ Saved email UID ${uid} → ${fromEmail}`);
  }
}
