import { Module } from '@nestjs/common';
import { SolicitudesProveedorService } from './solicitudes-proveedor.service';
import { SolicitudesProveedorController } from './solicitudes-proveedor.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SolicitudesProveedorController],
  providers: [SolicitudesProveedorService],
  exports: [SolicitudesProveedorService],
})
export class SolicitudesProveedorModule {}
