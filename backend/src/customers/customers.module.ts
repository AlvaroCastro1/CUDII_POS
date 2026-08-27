import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PuntosExpiracionService } from './puntos-expiracion.service';

/** Módulo de clientes: CRUD, lealtad, crédito (fiados) y caducidad de puntos */
@Module({
  controllers: [CustomersController],
  providers: [CustomersService, PuntosExpiracionService],
  exports: [CustomersService],
})
export class CustomersModule {}
