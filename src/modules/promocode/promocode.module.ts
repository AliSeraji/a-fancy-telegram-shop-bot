import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promocode } from './promocode.entity';
import { PromocodeService } from './promocode.service';
import { PromocodeController } from './promocode.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Promocode])],
  providers: [PromocodeService],
  controllers: [PromocodeController],
  exports: [PromocodeService],
})
export class PromocodeModule {}
