import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: Number(this.configService.get<string>('EMAIL_PORT')),
      secure: this.configService.get<string>('EMAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  async sendEmail(
    nombre: string,
    email: string,
    mensaje: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"${nombre}" <${email}>`,
      to: this.configService.get<string>('EMAIL_USER'),
      subject: `New message from ${nombre}`,
      text: mensaje,
    });
  }
}
