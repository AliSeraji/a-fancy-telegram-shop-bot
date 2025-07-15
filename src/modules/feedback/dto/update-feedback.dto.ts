import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class UpdateFeedbackDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}