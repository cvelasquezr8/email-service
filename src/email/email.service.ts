import { HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

import { ContactEmailDto } from './dto/contact-email.dto';
import { EmailResponse } from '../interfaces/emailResponse.interface';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(contacEmail: ContactEmailDto): Promise<EmailResponse> {
    try {
      await this.mailerService.sendMail({
        from: `"Carlos Velasquez Website" <${this.configService.get<string>('CONTAC_EMAIL')}>`,
        to: this.configService.get<string>('CONTAC_EMAIL'),
        subject: `[Contact Form] New message from ${contacEmail.name}`,
        replyTo: contacEmail.email,
        text: `New message from ${contacEmail.name}:\nEmail: ${contacEmail.email}\nMessage: ${contacEmail.message}`,
        headers: {
          'X-Mailer': 'NestJS Contact Service',
        },
      });

      return {
        success: true,
        statusCode: HttpStatus.CREATED,
        message: 'Email sent successfully',
      };
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Failed to send email',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
