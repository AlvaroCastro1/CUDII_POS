import { Module } from '@nestjs/common';
import { MermaService } from './merma.service';
import { MermaController } from './merma.controller';

@Module({
  controllers: [MermaController],
  providers: [MermaService],
  exports: [MermaService],
})
export class MermaModule {}
