// import {
//   Injectable,
//   Logger,
//   OnModuleInit,
//   OnModuleDestroy,
// } from '@nestjs/common';
// import { PrismaService } from 'prisma/prisma.service';
// import { ImapFlow } from 'imapflow';

// @Injectable()
// export class ImapService implements OnModuleInit, OnModuleDestroy {
//   private logger = new Logger('IMAP');
//   private clients: Map<number, ImapFlow> = new Map();

//   constructor(private prisma: PrismaService) {}

//   // ================================================================
//   // 🔥 IMAP BOOTSTRAP
//   // ================================================================
//   async onModuleInit() {
//     this.logger.log('🔄 IMAP Service Starting...');
//     await this.initializeMailboxes();
//   }

//   async onModuleDestroy() {
//     this.logger.warn('🔌 Stopping IMAP clients...');
//     for (const client of this.clients.values()) {
//       try {
//         await client.logout();
//       } catch {}
//     }
//   }

//   private async initializeMailboxes() {
//     const mailboxes = await this.prisma.mailbox.findMany();
//     this.logger.log(`📦 Loaded ${mailboxes.length} mailboxes from DB`);

//     for (const box of mailboxes) {
//       this.startMailbox(box);
//     }
//   }

//   // ================================================================
//   // 🔥 CONNECT MAILBOX
//   // ================================================================
//   private async startMailbox(box: any) {
//     const host = box.imap_host || process.env.IMAP_HOST;
//     const port = box.imap_port || Number(process.env.IMAP_PORT) || 993;
//     const secure = box.is_ssl ?? port === 993;

//     const user = box.email_address;
//     const pass = box.password;

//     this.logger.log(`📬 Booting IMAP for: ${user}`);
//     this.logger.log(`🔧 Host: ${host}, Port: ${port}, SSL: ${secure}`);
//     this.logger.log(`🔐 Auth → user=${user}, pass=[HIDDEN]`);

//     const client = new ImapFlow({
//       host,
//       port,
//       secure,
//       auth: { user, pass },
//       logger: false,
//       tls: { rejectUnauthorized: false },
//       connectionTimeout: 30000,
//     });

//     client.on('error', (err) => {
//       this.logger.error(`❌ IMAP Error (${user}): ${err?.message}`);
//       this.reconnect(box);
//     });

//     client.on('close', () => {
//       this.logger.warn(`⚠️ IMAP Closed → ${user}`);
//       this.reconnect(box);
//     });

//     try {
//       this.logger.log(`🔌 Connecting → ${host}:${port}`);
//       await client.connect();
//       this.logger.log(`✅ Login OK → ${user}`);

//       this.clients.set(box.id, client);
//       this.listenForEvents(client, box);

//       await this.syncInbox(box.id);
//     } catch (err) {
//       this.logger.error(`❌ Connection Failed for ${user}`);
//       this.logger.error(err);
//       this.reconnect(box);
//     }
//   }

//   private reconnect(box: any) {
//     this.logger.warn(`🔁 Reconnecting in 30 seconds → ${box.email_address}`);
//     setTimeout(() => this.startMailbox(box), 30000);
//   }

//   private listenForEvents(client: ImapFlow, box: any) {
//     client.on('exists', () => {
//       this.logger.log(`📥 New Email Arrived → ${box.email_address}`);
//       this.syncInbox(box.id);
//     });
//   }

//   // ================================================================
//   // 🔥 SYNC / FETCH ALL EMAILS
//   // ================================================================
//   async syncInbox(mailbox_id: number) {
//     this.logger.log(`🔁 Syncing INBOX for mailbox ${mailbox_id}`);

//     const box = await this.prisma.mailbox.findUnique({
//       where: { id: mailbox_id },
//     });

//     if (!box) {
//       this.logger.error(`❌ Mailbox ${mailbox_id} not found in DB`);
//       return;
//     }

//     const client = this.clients.get(mailbox_id);
//     if (!client || !client.usable) {
//       this.logger.warn(`❌ IMAP client not ready for mailbox ${mailbox_id}`);
//       return;
//     }

//     try {
//       await client.mailboxOpen('INBOX');

//       const messages = await client.fetch('1:*', {
//         uid: true,
//         envelope: true,
//         source: true,
//       });

//       for await (const msg of messages) {
//         await this.saveMessage(box, msg);
//       }
//     } catch (err) {
//       this.logger.error(`❌ Failed INBOX sync for ${box.email_address}`);
//       this.logger.error(err);
//     }
//   }

//   // ================================================================
//   // 🔥 saveMessage() — Business Email → Users(USER) → Round Robin
//   // ================================================================
//   private async saveMessage(box: any, msg: any) {
//     try {
//       // 1) Extract + normalize
//       const messageId = msg.envelope.messageId;
//       const rawSubject = msg.envelope.subject || '(no subject)';
//       const subject = rawSubject.replace(/^(Re:|Fwd:)\s*/gi, '').trim();

//       const fromEmail =
//         msg.envelope.from?.[0]?.address?.toLowerCase().trim() || null;

//       if (!fromEmail) {
//         this.logger.error('❌ Cannot process email: FROM address missing');
//         return;
//       }

//       const toEmails =
//         msg.envelope.to?.map((x) => x.address?.toLowerCase().trim()) || [];

//       this.logger.log(
//         `📨 Processing → ${subject} | From=${fromEmail} | Mailbox=${box.email_address}`,
//       );

//       // 2) Prevent duplicates
//       const exists = await this.prisma.email.findFirst({
//         where: { message_id: messageId },
//       });

//       if (exists) {
//         this.logger.debug(`⏩ Duplicate skipped: ${messageId}`);
//         return;
//       }

//       // 3) Find BUSINESS by its email (NEW LOGIC)
//       const business = await this.prisma.business.findFirst({
//         where: { email: box.email_address },
//       });

//       if (!business) {
//         this.logger.error(
//           `❌ No business found with email: ${box.email_address}`,
//         );
//         return;
//       }

//       // 4) Customer find/create under THIS business
//       let customer = await this.prisma.customer.findFirst({
//         where: {
//           business_id: business.id,
//           email: fromEmail,
//         },
//       });

//       if (!customer) {
//         try {
//           customer = await this.prisma.customer.create({
//             data: {
//               business_id: business.id,
//               email: fromEmail,
//               name: fromEmail.split('@')[0],
//               source: 'INBOUND_EMAIL',
//               last_contact_at: new Date(),
//             },
//           });
//           this.logger.log(`👤 Customer created → ${customer.id}`);
//         } catch (err) {
//           this.logger.error(
//             `❌ Customer create failed → ${err?.message || err}`,
//           );
//           return;
//         }
//       }

//       // 5) Try to find existing thread (same business + mailbox + customer + subject)
//       let thread = await this.prisma.emailThread.findFirst({
//         where: {
//           business_id: business.id,
//           mailbox_id: box.id,
//           customer_id: customer.id,
//           subject,
//           is_archived: false,
//         },
//       });

//       // 6) Fetch agents: all USERS under this business
//       const agents = await this.prisma.user.findMany({
//         where: {
//           business_id: business.id,
//           role_id: 3, // USER role = Agent
//         },
//         orderBy: { id: 'asc' },
//       });

//       this.logger.log(
//         `👥 Agents for business ${business.id}: ${agents
//           .map((a) => a.id)
//           .join(', ')}`,
//       );

//       let assignedUserId: number | null = null;

//       // Helper: compute next agent by Round Robin
//       const pickNextAgent = async (): Promise<number | null> => {
//         if (agents.length === 0) return null;

//         const pointer = business.last_assigned_user_id;
//         let chosen: number;

//         if (!pointer) {
//           chosen = agents[0].id;
//         } else {
//           const idx = agents.findIndex((a) => a.id === pointer);
//           if (idx === -1 || idx === agents.length - 1) {
//             chosen = agents[0].id;
//           } else {
//             chosen = agents[idx + 1].id;
//           }
//         }

//         await this.prisma.business.update({
//           where: { id: business.id },
//           data: { last_assigned_user_id: chosen },
//         });

//         return chosen;
//       };

//       // 7) NEW THREAD → assign via Round Robin
//       if (!thread) {
//         assignedUserId = await pickNextAgent();

//         thread = await this.prisma.emailThread.create({
//           data: {
//             business_id: business.id,
//             mailbox_id: box.id,
//             subject,
//             customer_id: customer.id,
//             assigned_user_id: assignedUserId,
//             last_message_at: new Date(),
//           },
//         });

//         this.logger.log(
//           `🧵 New thread created → ${thread.id} | Agent = ${assignedUserId}`,
//         );
//       } else {
//         // 8) OLD THREAD → update last_message_at + auto-assign if needed
//         await this.prisma.emailThread.update({
//           where: { id: thread.id },
//           data: { last_message_at: new Date() },
//         });

//         if (!thread.assigned_user_id) {
//           const autoAssigned = await pickNextAgent();
//           if (autoAssigned) {
//             await this.prisma.emailThread.update({
//               where: { id: thread.id },
//               data: { assigned_user_id: autoAssigned },
//             });

//             this.logger.log(
//               `👤 Old thread auto-assigned → Thread ${thread.id} | Agent = ${autoAssigned}`,
//             );
//           } else {
//             this.logger.warn(
//               `⚠️ Old thread ${thread.id} has no available agents`,
//             );
//           }
//         }
//       }

//       // 9) Save Email
//       await this.prisma.email.create({
//         data: {
//           business_id: business.id,
//           mailbox_id: box.id,
//           thread_id: thread.id,
//           message_id: messageId,
//           from_address: fromEmail,
//           to_addresses: toEmails,
//           subject,
//           body_html: msg.source.toString(),
//           folder: 'INBOX',
//           received_at: new Date(),
//           is_read: false,
//         },
//       });

//       this.logger.log(
//         `💾 Email saved → Thread ${thread.id} | Agent ${
//           thread.assigned_user_id || assignedUserId || 'None'
//         }`,
//       );
//     } catch (err) {
//       this.logger.error(`❌ saveMessage() failed → ${err?.message || err}`);
//     }
//   }
// }
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
      connectionTimeout: 30000, // stable timeout
    });

    // ====== EVENTS ======

    client.on('error', (err) => {
      this.logger.error(`❌ IMAP Error (${user}): ${err?.message}`);
      this.reconnect(box);
    });

    client.on('close', () => {
      this.logger.warn(`⚠️ IMAP Closed → ${user}`);
      this.reconnect(box);
    });

    // ====== CONNECT ======

    try {
      this.logger.log(`🔌 Connecting → ${host}:${port}`);
      await client.connect();
      this.logger.log(`✅ Login OK → ${user}`);

      this.clients.set(box.id, client);
      this.listenForEvents(client, box);

      // Initial inbox sync
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
