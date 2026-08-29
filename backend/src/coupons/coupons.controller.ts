import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '@prisma/client';

/** Controlador de cupones de descuento */
@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /** Listar cupones con paginación y búsqueda */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
  ) {
    return this.couponsService.findAll(
      user.empresaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
      incluirInactivos === 'true',
    );
  }

  /** Validar un cupón por código (sin redimirlo) — para el cajero al cobrar */
  @Get('validar')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  validar(
    @CurrentUser() user: CurrentUserPayload,
    @Query('codigo') codigo: string,
    @Query('clienteId') clienteId?: string,
    @Query('subtotalBase') subtotalBase?: string,
  ) {
    return this.couponsService.validar(user.empresaId, codigo || '', {
      clienteId,
      subtotalBase: subtotalBase ? parseFloat(subtotalBase) : undefined,
    });
  }

  /** Detalle de un cupón */
  @Get(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.couponsService.findOne(user.empresaId, id);
  }

  /** Crear cupón */
  @Post()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  create(
    @Body() dto: CreateCouponDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.couponsService.create(user.empresaId, dto);
  }

  /** Actualizar cupón */
  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.couponsService.update(user.empresaId, id, dto);
  }

  /** Desactivar cupón */
  @Delete(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.couponsService.remove(user.empresaId, id);
  }
}
