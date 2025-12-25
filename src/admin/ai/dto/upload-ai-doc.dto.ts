import { IsOptional, IsString } from 'class-validator';

export class UploadAiDocDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  tags?: string[];
}
