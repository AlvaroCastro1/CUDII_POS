import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Módulo global de Auditoría.
 * Se marca como @Global para que AuditService esté disponible
 * en todos los módulos sin necesidad de importar AuditModule explícitamente.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
