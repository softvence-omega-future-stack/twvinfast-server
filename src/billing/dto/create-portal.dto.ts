// src/billing/dto/create-portal.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePortalDto {
  @IsString()
  @IsNotEmpty()
  stripeCustomerId: string;
}
