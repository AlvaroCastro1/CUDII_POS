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
import { SolicitudesProveedorService } from './solicitudes-proveedor.service';
import { CreateSolicitudProveedorDto } from './dto/create-solicitud-proveedor.dto';
import { UpdateSolicitudProveedorDto } from './dto/update-solicitud-proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { EstadoSolicitudProveedor, Rol } from '@prisma/client';

import { RecibirMercanciaSolicitudDto } from './dto/recibir-mercancia.dto';

@Controller('solicitudes-proveedor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesProveedorController {
  constructor(private readonly solicitudesProveedorService: SolicitudesProveedorService) {}

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createDto: CreateSolicitudProveedorDto,
  ) {
    return this.solicitudesProveedorService.create(user.empresaId, user.id, createDto);
  }

  @Post(':id/recibir')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  recibirMercancia(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() recibirDto: RecibirMercanciaSolicitudDto,
  ) {
    return this.solicitudesProveedorService.recibirMercancia(
      user.empresaId,
      user.id,
      id,
      recibirDto,
    );
  }

  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('proveedorId') proveedorId?: string,
    @Query('estado') estado?: EstadoSolicitudProveedor,
    @Query('q') q?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('incluirInactivos') incluirInactivos?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solicitudesProveedorService.findAll(user.empresaId, {
      proveedorId,
      estado,
      q,
      fechaInicio,
      fechaFin,
      incluirInactivos: incluirInactivos === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.solicitudesProveedorService.findOne(user.empresaId, id);
  }

  @Patch(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN)
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateDto: UpdateSolicitudProveedorDto,
  ) {
    return this.solicitudesProveedorService.update(user.empresaId, user.id, id, updateDto);
  }

  @Patch(':id/reactivar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE)
  reactivar(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.solicitudesProveedorService.update(user.empresaId, user.id, id, { estaActivo: true });
  }

  @Delete(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.solicitudesProveedorService.remove(user.empresaId, user.id, id);
  }
}

