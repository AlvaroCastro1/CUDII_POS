import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TraspasosService } from './traspasos.service';
import { CreateTraspasoDto } from './dto/create-traspaso.dto';
import { RecibirTraspasoDto } from './dto/recibir-traspaso.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { EstadoTraspaso, Rol } from '@prisma/client';

@Controller('traspasos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TraspasosController {
  constructor(private readonly traspasosService: TraspasosService) {}

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createDto: CreateTraspasoDto,
  ) {
    return this.traspasosService.create(user.empresaId, user.id, createDto);
  }

  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('sucursalOrigenId') sucursalOrigenId?: string,
    @Query('sucursalDestinoId') sucursalDestinoId?: string,
    @Query('estado') estado?: EstadoTraspaso,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.traspasosService.findAll(user.empresaId, {
      sucursalOrigenId,
      sucursalDestinoId,
      estado,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.traspasosService.findOne(user.empresaId, id);
  }

  @Post(':id/recibir')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  recibir(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() recibirDto: RecibirTraspasoDto,
  ) {
    return this.traspasosService.recibir(user.empresaId, user.id, id, recibirDto);
  }
}
