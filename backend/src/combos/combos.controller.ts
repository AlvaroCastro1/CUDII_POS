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
import { CombosService } from './combos.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '@prisma/client';

/** Controlador de combos/paquetes (promociones) */
@Controller('combos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CombosController {
  constructor(private readonly combosService: CombosService) {}

  /** Listar combos con paginación y búsqueda */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
    @Query('soloVigentes') soloVigentes: string = 'false',
  ) {
    return this.combosService.findAll(
      user.empresaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
      incluirInactivos === 'true',
      soloVigentes === 'true',
    );
  }

  /** Detalle de un combo */
  @Get(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.combosService.findOne(user.empresaId, id);
  }

  /** Crear combo */
  @Post()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  create(
    @Body() dto: CreateComboDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.combosService.create(user.empresaId, user.id, dto);
  }

  /** Actualizar combo */
  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComboDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.combosService.update(user.empresaId, id, dto, user.id);
  }

  /** Desactivar combo (soft delete) */
  @Delete(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.combosService.remove(user.empresaId, id, user.id);
  }
}