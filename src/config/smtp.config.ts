import * as nodemailer from 'nodemailer';

/**
 * DB (mailbox table) থেকে SMTP transporter বানায়
 */
export const createSmtpTransporterFromDb = (mailbox: {
  smtp_host: string;
  smtp_port: number;
  smtp_password: string;
  email_address: string;
  is_ssl?: boolean | null;
}) => {
  if (
    !mailbox.smtp_host ||
    !mailbox.smtp_port ||
    !mailbox.smtp_password ||
    !mailbox.email_address
  ) {
    throw new Error('SMTP config missing in mailbox');
  }

  return nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: mailbox.smtp_port,
    secure: mailbox.is_ssl ?? mailbox.smtp_port === 465, // 465 = SSL
    auth: {
      user: mailbox.email_address,
      pass: mailbox.smtp_password,
    },
  });
};
