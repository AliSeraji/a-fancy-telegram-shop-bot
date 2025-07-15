import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PAYMENT_TYPE } from '../../../common/constants';

export class UpdatePaymentDto {
  @IsString()
  @IsOptional()
  @IsEnum(PAYMENT_TYPE)
  paymentType?: typeof PAYMENT_TYPE[keyof typeof PAYMENT_TYPE];
}