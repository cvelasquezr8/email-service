import { Controller, Post, Body, UseInterceptors, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { EmailService } from './email.service';
import { ContactEmailDto } from './dto/contact-email.dto';
import { EmailResponse } from '../interfaces/emailResponse.interface';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async sendEmail(@Body() contactEmailDto: ContactEmailDto): Promise<EmailResponse> {
    return this.emailService.sendEmail(contactEmailDto);
  }
}
