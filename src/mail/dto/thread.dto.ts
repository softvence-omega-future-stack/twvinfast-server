import { IsNumber } from 'class-validator';

export class AssignThreadDto {
  @IsNumber()
  thread_id: number;

  @IsNumber()
  user_id: number;
}
