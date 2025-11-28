import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ImapFlow } from 'imapflow';

@Injectable()
export class ImapService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('IMAP');
  private clients: Map<number, ImapFlow> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('🔄 IMAP Debug Service Starting...');
    await this.initializeMailboxes();
  }

  async onModuleDestroy() {
    this.logger.warn('🔌 Stopping IMAP clients...');
    for (const client of this.clients.values()) {
      await client.logout().catch(() => null);
    }
  }

  private async initializeMailboxes() {
    const mailboxes = await this.prisma.mailbox.findMany();
    this.logger.log(`📦 Loaded ${mailboxes.length} mailboxes from DB`);

    for (const box of mailboxes) {
      this.startMailbox(box);
    }
  }

  private async startMailbox(box: any) {
    this.logger.log(`📬 Booting IMAP for: ${box.email_address}`);
    this.logger.log(
      `🔧 Host: ${box.imap_host}, Port: ${box.imap_port}, SSL: ${box.imap_port === 993}`,
    );

    const client = new ImapFlow({
      host: box.imap_host,
      port: box.imap_port,
      secure: box.imap_port === 993,
      auth: {
        user: box.email_address,
        pass: box.password,
      },
      logger: false, // <— FIXED
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
    });

    client.on('error', (err) => {
      this.logger.error(
        `❌ IMAP Error (${box.email_address}): ${err?.message}`,
      );
      this.reconnect(box);
    });

    client.on('close', () => {
      this.logger.warn(`⚠️ IMAP Closed → ${box.email_address}`);
      this.reconnect(box);
    });

    try {
      this.logger.log(`🔌 Connecting → ${box.imap_host}:${box.imap_port}`);
      await client.connect();
      this.logger.log(`✅ Connected to IMAP: ${box.email_address}`);

      this.clients.set(box.id, client);
      this.listenForEvents(client, box);

      await this.syncInbox(box.id);
    } catch (err) {
      this.logger.error(`❌ Connection Failed for ${box.email_address}`);
      this.logger.error(err);
      this.reconnect(box);
    }
  }

  private reconnect(box: any) {
    this.logger.warn(`🔁 Reconnecting in 30 seconds → ${box.email_address}`);
    setTimeout(() => this.startMailbox(box), 30000);
  }

  private listenForEvents(client: ImapFlow, box: any) {
    client.on('exists', () => {
      this.logger.log(`📥 New Email Arrived → ${box.email_address}`);
      this.syncInbox(box.id);
    });
  }

  async syncInbox(mailbox_id: number) {
    this.logger.log(`🔁 Syncing INBOX for mailbox ${mailbox_id}`);

    const box = await this.prisma.mailbox.findUnique({
      where: { id: mailbox_id },
    });

    // <— FIXED (TS2322)
    if (!box) {
      this.logger.error(`❌ Mailbox ${mailbox_id} not found in DB`);
      return;
    }

    const client = this.clients.get(mailbox_id);
    if (!client || !client.usable) {
      this.logger.warn(`❌ IMAP client not ready for mailbox ${mailbox_id}`);
      return;
    }

    try {
      await client.mailboxOpen('INBOX');
      const messages = await client.fetch('1:*', {
        uid: true,
        envelope: true,
        source: true,
      });

      for await (const msg of messages) {
        await this.saveMessage(box, msg);
      }
    } catch (err) {
      this.logger.error(`❌ Failed INBOX sync for ${box.email_address}`);
      this.logger.error(err);
    }
  }

  private async saveMessage(box: any, msg: any) {
    const messageId = msg.envelope.messageId;
    const subject = msg.envelope.subject || '(no subject)';
    const from = msg.envelope.from?.[0]?.address || '';
    const to = msg.envelope.to?.map((x) => x.address) || [];

    this.logger.log(`📨 Processing email → ${subject}`);

    const exists = await this.prisma.email.findFirst({
      where: { message_id: messageId },
    });

    if (exists) {
      this.logger.debug(`⏩ Duplicate, skipping: ${messageId}`);
      return;
    }

    let thread = await this.prisma.emailThread.findFirst({
      where: { mailbox_id: box.id, subject },
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
    }

    await this.prisma.email.create({
      data: {
        business_id: box.business_id,
        mailbox_id: box.id,
        thread_id: thread.id,
        message_id: messageId,
        from_address: from,
        to_addresses: to,
        subject,
        body_html: msg.source.toString(),
        folder: 'INBOX',
        received_at: new Date(),
      },
    });

    this.logger.log(`💾 Saved email → Thread ${thread.id}`);
  }
}
