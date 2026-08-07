import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

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
    @Query('incluirInactivos') incluirInactivos: string = 'false'
  ) {
    return this.inventoryService.getStock(
      sucursalId, 
      user.empresaId, 
      parseInt(page, 10) || 1, 
      parseInt(limit, 10) || 20, 
      search,
      incluirInactivos === 'true'
    );
  }

  @Post('adjust')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  adjustStock(@Body() body: { productoId: string, sucursalId: string, cantidad: number, motivo: string }, @CurrentUser() user: CurrentUserPayload) {
    return this.inventoryService.adjustStock(body, user.empresaId, user.id);
  }
}
