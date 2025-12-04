import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendEmailDto {
  @IsNumber()
  business_id: number;

  @IsNumber()
  mailbox_id: number;

  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsArray()
  @IsEmail({}, { each: true })
  to: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  html: string;
}
