import {
  Controller,
  Post,
  Body,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(
    @Body() body: { name: string; email: string; message: string },
  ) {
    if (!body || !body.name || !body.email || !body.message) {
      throw new BadRequestException(
        'Missing required fields: name, email, message',
      );
    }

    await this.emailService.sendEmail(body.name, body.email, body.message);
    return { message: 'Email send.' };
  }

  @Get('test')
  async sendTest() {
    await this.emailService.sendEmail(
      'Prueba NestJS',
      'no-reply@example.com',
      'Email test from NestJS',
    );
    return { message: 'Email test send.' };
  }
}
