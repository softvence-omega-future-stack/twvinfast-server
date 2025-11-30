// src/billing/dto/create-checkout.dto.ts
import { IsEmail, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsInt()
  businessId: number;

  @IsInt()
  planId: number;

  // Stripe price id for that plan
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @IsEmail()
  email: string;
}
