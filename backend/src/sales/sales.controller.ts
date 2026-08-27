import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async createSale(
    @Request() req: { user: CurrentUserPayload },
    @Body() dto: CrearVentaDto,
  ) {
    return this.salesService.createSale(req.user.id, req.user.empresaId, dto);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.CONTADOR)
  async findAllSales(
    @Request() req: { user: CurrentUserPayload },
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
    return this.salesService.findAllSales(req.user.empresaId, query);
  }

  @Get(':idOrFolio')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.CONTADOR)
  async findOneSale(
    @Request() req: { user: CurrentUserPayload },
    @Param('idOrFolio') idOrFolio: string,
  ) {
    return this.salesService.findOneSale(req.user.empresaId, idOrFolio);
  }
}
