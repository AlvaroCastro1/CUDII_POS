import { Module } from '@nestjs/common';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponsModule } from '../coupons/coupons.module';

/** Módulo de presupuestos/cotizaciones (D12) */
@Module({
  imports: [PrismaModule, CouponsModule],
  controllers: [PresupuestosController],
  providers: [PresupuestosService],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
