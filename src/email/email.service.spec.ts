import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { InternalServerErrorException } from '@nestjs/common';

import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'EMAIL_USER') return 'carlos@test.com';

      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('Should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Should send an email successfully', async () => {
    const dto = { name: 'Carlos', email: 'user@test.com', message: 'Hello' };
    mockMailerService.sendMail.mockResolvedValueOnce('OK');

    const result = await service.sendEmail(dto);
    expect(result).toEqual({
      success: true,
      message: 'Email sent successfully',
      statusCode: 201,
    });

    expect(mockMailerService.sendMail).toHaveBeenCalled();
  });

  it('Should throw InternalServerErrorException if sendMail fails', async () => {
    const dto = { name: 'Carlos', email: 'user@test.com', message: 'Hello' };

    mockMailerService.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));
    await expect(service.sendEmail(dto)).rejects.toThrow(InternalServerErrorException);
  });

  it('Should throw InternalServerErrorException with "Unknown error" if caught error is not an instance of Error', async () => {
    const dto = { name: 'Carlos', email: 'user@test.com', message: 'Hello' };

    mockMailerService.sendMail.mockRejectedValueOnce("Something went very wrong, but I'm not an object. Error.");
    await expect(service.sendEmail(dto)).rejects.toThrow(InternalServerErrorException);
  });
});
