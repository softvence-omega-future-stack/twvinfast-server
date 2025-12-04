import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class AiGenerateDto {
  @IsString()
  @IsNotEmpty()
  prompt: string; // last message / full mail content

  @IsOptional()
  @IsNumber()
  thread_id?: number;
}
