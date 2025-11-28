// import { Injectable } from '@nestjs/common';
// import { CreateMailDto } from './dto/create-mail.dto';
// import { UpdateMailDto } from './dto/update-mail.dto';

// @Injectable()
// export class MailService {
//   create(createMailDto: CreateMailDto) {
//     return 'This action adds a new mail';
//   }

//   findAll() {
//     return `This action returns all mail`;
//   }

//   findOne(id: number) {
//     return `This action returns a #${id} mail`;
//   }

//   update(id: number, updateMailDto: UpdateMailDto) {
//     return `This action updates a #${id} mail`;
//   }

//   remove(id: number) {
//     return `This action removes a #${id} mail`;
//   }
// }
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendMail(to: string, subject: string, html: string) {
    return await this.transporter.sendMail({
      from: `"AI Email Bot" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  }
}
