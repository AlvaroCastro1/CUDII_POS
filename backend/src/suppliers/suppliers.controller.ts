import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

/** Controlador de proveedores: CRUD completo */
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /** Crear un nuevo proveedor */
  @Post()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  create(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.suppliersService.create(user.empresaId, dto);
  }

  /** Listar proveedores con paginación y búsqueda */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.ALMACEN)
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
  ) {
    return this.suppliersService.findAll(
      user.empresaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
      incluirInactivos === 'true',
    );
  }

  /** Obtener un proveedor por ID */
  @Get(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.ALMACEN)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.suppliersService.findOne(user.empresaId, id);
  }

  /** Actualizar un proveedor */
  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.suppliersService.update(user.empresaId, id, dto);
  }

  /** Desactivar un proveedor (soft delete) */
  @Delete(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.suppliersService.remove(user.empresaId, id);
  }

  /** Reactivar un proveedor */
  @Patch(':id/reactivate-status')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  reactivate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.suppliersService.reactivate(user.empresaId, id);
  }
}
