import * as nodemailer from 'nodemailer';

export const createSmtpTransporter = () => {
  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP env variables not set');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};
