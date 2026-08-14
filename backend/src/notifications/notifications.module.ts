import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Módulo global de Notificaciones Internas.
 * Se marca como @Global para que NotificationsService esté disponible
 * en todos los módulos (cash-register, sales, etc.) sin importar explícitamente.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
