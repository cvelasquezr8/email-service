import { Controller, Post, Body, UseInterceptors } from '@nestjs/common';

import { EmailService } from './email.service';
import { ContactEmailDto } from './dto/contactEmail.dto';
import { IdempotencyInterceptor } from '../interceptors/idempontecy.interceptor';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @UseInterceptors(IdempotencyInterceptor)
  async sendEmail(@Body() contactEmailDto: ContactEmailDto): Promise<{ success: boolean; message: string }> {
    return this.emailService.sendEmail(contactEmailDto);
  }
}
