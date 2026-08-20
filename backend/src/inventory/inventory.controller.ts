import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EstadoLote, MotivoMerma, Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { CrearRecepcionDto } from './dto/crear-recepcion.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock/:sucursalId')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  getStock(
    @Param('sucursalId') sucursalId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
  ) {
    return this.inventoryService.getStock(
      sucursalId,
      user.empresaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
      incluirInactivos === 'true',
    );
  }

  @Post('adjust')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  adjustStock(
    @Body()
    body: {
      productoId: string;
      sucursalId: string;
      cantidad: number;
      motivo: string;
      loteId?: string;
      esMerma?: boolean;
      motivoMerma?: string;
      costoUnitario?: number;
      fechaCaducidad?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.adjustStock(
      {
        productoId: body.productoId,
        sucursalId: body.sucursalId,
        cantidad: body.cantidad,
        motivo: body.motivo,
        loteId: body.loteId,
        esMerma: body.esMerma,
        motivoMerma: body.motivoMerma as MotivoMerma | undefined,
        costoUnitario: body.costoUnitario,
        fechaCaducidad: body.fechaCaducidad,
      },
      user.empresaId,
      user.id,
    );
  }

  @Post('recepciones')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  createRecepcion(
    @Body() dto: CrearRecepcionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.createRecepcion(
      dto,
      user.empresaId,
      user.id,
    );
  }

  @Get('recepciones')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN, Rol.CONTADOR)
  findAllRecepciones(
    @CurrentUser() user: CurrentUserPayload,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.inventoryService.findAllRecepciones(user.empresaId, sucursalId);
  }

  @Get('lotes')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findLotes(
    @CurrentUser() user: CurrentUserPayload,
    @Query('sucursalId') sucursalId?: string,
    @Query('productoId') productoId?: string,
    @Query('estado') estado?: EstadoLote,
    @Query('porVencer') porVencer?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.findLotes(user.empresaId, {
      sucursalId,
      productoId,
      estado,
      porVencer: porVencer === 'true',
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('lotes/:id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findLoteById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findLoteById(user.empresaId, id);
  }

  @Get('vencimientos')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN, Rol.CONTADOR)
  findVencimientos(
    @CurrentUser() user: CurrentUserPayload,
    @Query('dias') dias?: string,
  ) {
    return this.inventoryService.findVencimientos(
      user.empresaId,
      dias ? parseInt(dias, 10) : undefined,
    );
  }

  @Post('vencimientos/verificar')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  verificarLotes(
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.verificarLotesPorVencer(user.empresaId);
  }
}
