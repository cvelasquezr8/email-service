import { Controller, Post, Body, Get } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(
    @Body() body: { nombre: string; email: string; mensaje: string },
  ) {
    await this.emailService.sendEmail(body.nombre, body.email, body.mensaje);
    return { message: 'Email send.' };
  }

  // @Get('test')
  // async sendTest() {
  //   await this.emailService.sendEmail(
  //     'Prueba NestJS',
  //     'no-reply@example.com',
  //     'Este es un mensaje de prueba enviado desde el microservicio de email.',
  //   );
  //   return { message: 'Correo de prueba enviado' };
  // }
}
