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

  // async onModuleInit() {
  //   this.logger.log('🔄 IMAP Debug Service Starting...');
  //   await this.initializeMailboxes();
  // }

  async onModuleInit() {
    this.logger.log('🔄 IMAP Debug Service Starting...');

    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `📨 Initializing IMAP Mailboxes (Attempt ${attempt}/${maxRetries})...`,
        );

        await this.initializeMailboxes();

        this.logger.log('✅ IMAP Mailboxes Initialized Successfully!');
        return;
      } catch (error) {
        this.logger.error(
          `❌ IMAP Initialization Failed (Attempt ${attempt}/${maxRetries}): ${error.message}`,
        );

        if (attempt === maxRetries) {
          this.logger.error(
            '🚨 Maximum retry limit reached. IMAP service could not initialize.',
          );
          throw error;
        }

        // wait before retry
        await new Promise((res) => setTimeout(res, retryDelay));
      }
    }
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
    const host = box.imap_host || process.env.IMAP_HOST;
    const port = box.imap_port || Number(process.env.IMAP_PORT) || 993;
    const secure = box.is_ssl ?? port === 993;

    const user = box.email_address || process.env.IMAP_USER;
    const pass = box.password || process.env.IMAP_PASS;

    this.logger.log(`📬 Booting IMAP for: ${user}`);
    this.logger.log(`🔧 Host: ${host}, Port: ${port}, SSL: ${secure}`);
    this.logger.log(
      `🔐 Auth → user=${user}, pass=${pass ? '[HIDDEN]' : '❌ MISSING'}`,
    );

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
    });

    client.on('error', (err) => {
      this.logger.error(`❌ IMAP Error (${user}): ${err?.message}`);
      this.reconnect(box);
    });

    client.on('close', () => {
      this.logger.warn(`⚠️ IMAP Closed → ${user}`);
      this.reconnect(box);
    });

    try {
      this.logger.log(`🔌 Connecting → ${host}:${port}`);
      await client.connect();
      this.logger.log(`✅ Login OK → ${user}`);

      this.clients.set(box.id, client);
      this.listenForEvents(client, box);

      await this.syncInbox(box.id);
    } catch (err) {
      this.logger.error(`❌ Connection Failed for ${user}`);
      this.logger.error(err);
      this.reconnect(box);
    }
  }

  private reconnect(box: any) {
    const email = box.email_address || process.env.IMAP_USER;
    this.logger.warn(`🔁 Reconnecting in 30 seconds → ${email}`);
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

    await this.prisma.email.create({
      data: {
        business_id: box.business_id,
        mailbox_id: box.id,
        message_id: messageId,
        from_address: from,
        to_addresses: to,
        subject,
        body_html: msg.source.toString(),
        folder: 'INBOX',
        received_at: new Date(),
      },
    });

    this.logger.log(`💾 Saved email`);
  }
}
