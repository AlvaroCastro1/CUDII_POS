import { Module } from '@nestjs/common';
import { TraspasosService } from './traspasos.service';
import { TraspasosController } from './traspasos.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TraspasosController],
  providers: [TraspasosService],
  exports: [TraspasosService],
})
export class TraspasosModule {}
