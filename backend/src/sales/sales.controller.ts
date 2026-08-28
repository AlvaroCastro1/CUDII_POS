import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '@prisma/client';
import { CrearVentaDto } from './dto/crear-venta.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async createSale(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CrearVentaDto,
  ) {
    return this.salesService.createSale(user.id, user.empresaId, dto);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.CONTADOR)
  async findAllSales(
    @CurrentUser() user: CurrentUserPayload,
    @Query()
    query: {
      sucursalId?: string;
      sesionCajaId?: string;
      cajeroId?: string;
      fechaInicio?: string;
      fechaFin?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.salesService.findAllSales(user.empresaId, query);
  }

  @Get(':idOrFolio')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.CONTADOR)
  async findOneSale(
    @CurrentUser() user: CurrentUserPayload,
    @Param('idOrFolio') idOrFolio: string,
  ) {
    return this.salesService.findOneSale(user.empresaId, idOrFolio);
  }
}
