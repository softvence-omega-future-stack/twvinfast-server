import { IsString, IsNumber, IsIn, IsOptional } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsIn(['month', 'year'])
  interval: 'month' | 'year';

  @IsOptional()
  email_limit?: number;

  @IsOptional()
  ai_credits?: number;

  @IsOptional()
  features?: Record<string, any>;
}
