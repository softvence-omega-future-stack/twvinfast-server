import { IsInt, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreatePortalDto {
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  returnUrl: string;
}

export class CreateCheckoutDto {
  @IsNotEmpty()
  @IsInt()
  planId: number;
}
