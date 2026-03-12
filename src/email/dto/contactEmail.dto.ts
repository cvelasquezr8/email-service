import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }): string => (typeof value === 'string' ? value.trim() : (value as string)))
  name!: string;

  @IsString()
  @IsEmail()
  @Transform(({ value }: { value: unknown }): string => (typeof value === 'string' ? value.trim() : (value as string)))
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }): string => (typeof value === 'string' ? value.trim() : (value as string)))
  message!: string;
}
