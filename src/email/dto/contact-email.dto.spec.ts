import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { ContactEmailDto } from './contact-email.dto';

describe('ContactEmailDto', () => {
  it('Should validate correctly and apply trim', async () => {
    const rawData = {
      name: '  Carlos Velasquez  ',
      email: '  test@example.com  ',
      message: '  Hello, this is a message.  ',
    };

    const dto = plainToInstance(ContactEmailDto, rawData);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.name).toBe('Carlos Velasquez');
    expect(dto.email).toBe('test@example.com');
    expect(dto.message).toBe('Hello, this is a message.');
  });

  it('Should fail if the email is invalid', async () => {
    const dto = plainToInstance(ContactEmailDto, {
      name: 'Carlos',
      email: 'invalid-email',
      message: 'A valid message',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('Should fail if required fields are empty', async () => {
    const dto = plainToInstance(ContactEmailDto, {
      name: '',
      email: 'test@test.com',
      message: '',
    });

    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('name');
    expect(errors.map((e) => e.property)).toContain('message');
  });

  it('Should fail if the message exceeds 500 characters', async () => {
    const dto = plainToInstance(ContactEmailDto, {
      name: 'Carlos',
      email: 'test@test.com',
      message: 'a'.repeat(501),
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('Should handle non-string values in Transform (branch coverage)', async () => {
    const rawData = {
      name: 123,
      email: 'test@test.com',
      message: 'Hello',
    };

    const dto = plainToInstance(ContactEmailDto, rawData);
    expect(dto.name).toBe(123);
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('name');
  });

  it('Should handle null values in Transform (branch coverage)', async () => {
    const rawData = {
      name: 'Carlos',
      email: 'test@test.com',
      message: null,
    };

    const dto = plainToInstance(ContactEmailDto, rawData);
    expect(dto.message).toBeNull();
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('message');
  });

  it('Should handle non-string values in all fields for full branch coverage', async () => {
    const rawData = {
      name: 123,
      email: true,
      message: { text: 'object' },
    };

    const dto = plainToInstance(ContactEmailDto, rawData);
    expect(dto.name).toBe(123);
    expect(typeof dto.email).toBe('boolean');
    expect(typeof dto.message).toBe('object');
    const errors = await validate(dto);
    expect(errors.length).toBe(3);
  });
});
