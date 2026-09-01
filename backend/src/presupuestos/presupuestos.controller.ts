import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PresupuestosService } from './presupuestos.service';
import { CrearPresupuestoDto } from './dto/crear-presupuesto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '@prisma/client';

/** Controlador de presupuestos/cotizaciones (D12) */
@Controller('presupuestos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  /** Crear un presupuesto (cotización) sin tocar caja ni inventario */
  @Post()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  crear(@Body() dto: CrearPresupuestoDto, @CurrentUser() user: CurrentUserPayload) {
    return this.presupuestosService.crear(user.id, user.empresaId, dto);
  }

  /** Listar presupuestos con paginación y filtros */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  listar(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('estado') estado: string = '',
    @Query('fechaInicio') fechaInicio: string = '',
    @Query('fechaFin') fechaFin: string = '',
    @Query('busqueda') busqueda: string = '',
  ) {
    return this.presupuestosService.listar(
      user.empresaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      { estado, fechaInicio, fechaFin, busqueda },
    );
  }

  /** Detalle de un presupuesto con precios congelado/actual/efectivo */
  @Get(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  detalle(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.presupuestosService.detalle(user.empresaId, id);
  }

  /** Cancelar un presupuesto abierto */
  @Patch(':id/cancelar')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  cancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.presupuestosService.cancelar(user.empresaId, id, user.id);
  }

  /** Descancelar un presupuesto cancelado */
  @Patch(':id/descancelar')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  descancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.presupuestosService.descancelar(user.empresaId, id, user.id);
  }
}
