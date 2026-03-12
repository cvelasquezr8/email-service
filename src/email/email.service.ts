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

  async sendEmail(contactEmail: ContactEmailDto): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Sending email with the following details:', contactEmail);

      const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@carlos-velasquez.dev>`;

      const smtpUser = this.configService.get<string>('EMAIL_USER') || 'contact@carlos-velasquez.dev';
      const recipient = smtpUser;

      await this.mailerService.sendMail({
        from: `"Carlos Velasquez Website" <${smtpUser}>`,
        to: recipient,
        envelope: { from: smtpUser, to: [recipient] },
        subject: `[Contact Form] New message from ${contactEmail.name}`,
        replyTo: contactEmail.email,
        text: `New message from ${contactEmail.name}:\nEmail: ${contactEmail.email}\nMessage: ${contactEmail.message}`,
        html: `<p>New message from <strong>${contactEmail.name}</strong></p><p>Email: ${contactEmail.email}</p><p>Message:</p><p>${contactEmail.message.replace(/\n/g, '<br/>')}</p>`,
        headers: {
          'X-Mailer': 'NestJS Contact Service',
          'List-Unsubscribe': '<mailto:contact@carlos-velasquez.dev?subject=unsubscribe>',
          'Message-ID': messageId,
        },
      });

      return { success: true, message: 'Email sent successfully' };
    } catch (error: unknown) {
      console.error('Email send error:', error);
      throw new InternalServerErrorException(
        'Failed to send email',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
