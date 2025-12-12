import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';

@Injectable()
export class ImapSyncService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('IMAP-SYNC');
  private clients: Map<number, ImapFlow> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('🚀 Auto IMAP Sync Engine Starting...');
    await this.loadAllMailboxes();
  }

  async onModuleDestroy() {
    this.logger.warn('🔌 Stopping IMAP sync engine...');
    for (const client of this.clients.values()) {
      await client.logout().catch(() => null);
    }
  }

  /** Load all mailboxes from DB and start IMAP connections */
  private async loadAllMailboxes() {
    const mailboxes = await this.prisma.mailbox.findMany();

    this.logger.log(`📦 Loaded ${mailboxes.length} mailboxes`);

    for (const box of mailboxes) {
      await this.startMailbox(box);
    }
  }

  /** Start IMAP client for a mailbox */
  private async startMailbox(box: any) {
    if (!box.imap_password) {
      this.logger.error(`❌ Missing IMAP password for mailbox ID ${box.id}`);
      return;
    }

    const client = new ImapFlow({
      host: box.imap_host,
      port: box.imap_port,
      secure: box.is_ssl ?? true,
      auth: {
        user: box.email_address,
        pass: box.imap_password,
      },
      logger: false,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 20000,
    });

    // Client error event
    client.on('error', (err) => {
      this.logger.error(
        `❌ IMAP Error [${box.email_address}] → ${err.message}`,
      );
      this.reconnect(box);
    });

    // IMAP closed event
    client.on('close', () => {
      this.logger.warn(`⚠️ IMAP Closed → ${box.email_address}`);
      this.reconnect(box);
    });

    // IMAP IDLE → REAL-TIME new email detection
    client.on('exists', () => {
      this.logger.log(`📥 New email detected → ${box.email_address}`);
      this.syncInbox(box.id);
    });

    try {
      await client.connect();
      await client.mailboxOpen('INBOX');

      this.logger.log(`✅ IMAP Connected → ${box.email_address}`);
      this.clients.set(box.id, client);

      // Initial sync
      await this.syncInbox(box.id);
    } catch (err) {
      this.logger.error(`❌ IMAP Login Failed (${box.email_address})`);
      this.logger.error(err);
      this.reconnect(box);
    }
  }

  /** Auto reconnect after failure */
  private reconnect(box: any) {
    this.logger.warn(`🔁 Reconnecting in 15 seconds → ${box.email_address}`);
    setTimeout(() => this.startMailbox(box), 15000);
  }

  /** RUN EVERY 30 SECONDS — Ensures no mailbox is dropped */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async ensureHealthyConnections() {
    this.logger.log('🩺 Checking IMAP connections...');

    const mailboxes = await this.prisma.mailbox.findMany();

    for (const box of mailboxes) {
      const client = this.clients.get(box.id);

      if (!client || !client.usable) {
        this.logger.warn(`🛑 Restarting IMAP → ${box.email_address}`);
        await this.startMailbox(box);
      }
    }
  }

  /** MAIN FUNCTION → Sync emails from IMAP INBOX */
  async syncInbox(mailbox_id: number) {
    const box = await this.prisma.mailbox.findUnique({
      where: { id: mailbox_id },
    });

    if (!box) return;

    const client = this.clients.get(mailbox_id);

    if (!client?.usable) {
      this.logger.warn(`❌ IMAP client not ready for ${box.email_address}`);
      return;
    }

    await client.mailboxOpen('INBOX');

    const messages = await client.fetch('1:*', {
      uid: true,
      envelope: true,
      source: true,
    });

    for await (const msg of messages) {
      await this.processEmail(box, msg);
    }
  }

  /** Save new email to DB */
  private async processEmail(box: any, msg: any) {
    const message_id = msg.envelope.messageId;

    const existing = await this.prisma.email.findFirst({
      where: { message_id },
    });

    if (existing) return; // avoid duplicates

    const subject = msg.envelope.subject ?? '(no subject)';
    const from = msg.envelope.from?.[0]?.address;
    const to = msg.envelope.to?.map((x) => x.address) || [];
    const html = msg.source.toString();

    // Create or update thread
    let thread = await this.prisma.emailThread.findFirst({
      where: {
        mailbox_id: box.id,
        subject,
      },
    });

    if (!thread) {
      thread = await this.prisma.emailThread.create({
        data: {
          business_id: box.business_id,
          mailbox_id: box.id,
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

    // Save email
    await this.prisma.email.create({
      data: {
        business_id: box.business_id,
        mailbox_id: box.id,
        thread_id: thread.id,

        message_id,
        from_address: from,
        to_addresses: to,
        body_html: html,
        subject,

        folder: 'INBOX',
        received_at: new Date(),
      },
    });

    this.logger.log(`💾 Saved email → ${subject}`);
  }
}
