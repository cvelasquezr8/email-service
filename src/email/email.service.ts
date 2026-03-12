import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { ContactEmailDto } from './dto/contactEmail.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(contacEmail: ContactEmailDto): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Sending email with the following details:', contacEmail);
      await this.mailerService.sendMail({
        from: '"Carlos Velasquez Website" <contact@carlos-velasquez.dev>',
        // to: this.configService.get<string>('EMAIL_USER'),
        to: 'contact@carlos-velasquez.dev',
        subject: `[Contact Form] New message from ${contacEmail.name}`,
        replyTo: contacEmail.email,
        text: `New message from ${contacEmail.name}:\nEmail: ${contacEmail.email}\nMessage: ${contacEmail.message}`,
        headers: {
          'X-Mailer': 'NestJS Contact Service',
        },
      });

      return { success: true, message: 'Email sent successfully' };
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Failed to send email',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
