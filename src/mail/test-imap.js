const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT),
    secure: Number(process.env.IMAP_PORT) === 993,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    },
  });

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('IMAP Connected Successfully!');

    console.log('Opening INBOX...');
    await client.mailboxOpen('INBOX');
    console.log('INBOX opened!');

    await client.logout();
    console.log('IMAP Logout OK');
  } catch (err) {
    console.error('IMAP ERROR:', err);
  }
}

test();
