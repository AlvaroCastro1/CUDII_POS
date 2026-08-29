import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Controlador de Auditoría.
 * Permite a ADMIN, SUPER_ADMIN y GERENTE consultar el historial de
 * movimientos sensibles (LogActividad) de su empresa.
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Listar logs de auditoría de la empresa con filtros y paginación.
   * GET /audit?accion=CORTE_Z&severidad=critical&entidadTipo=corte_z&fechaInicio=...&fechaFin=...&limit=50&page=1
   */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE)
  async listar(
    @CurrentUser() user: CurrentUserPayload,
    @Query('accion') accion?: string,
    @Query('severidad') severidad?: string,
    @Query('entidadTipo') entidadTipo?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.auditService.buscarPorEmpresa(user.empresaId, {
      accion,
      severidad,
      entidadTipo,
      fechaInicio,
      fechaFin,
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    });
  }

  /**
   * Listar el historial de actividad del usuario autenticado (inicios de
   * sesión, ventas, devoluciones, cortes, etc.). GET /audit/me.
   * Accesible por cualquier usuario autenticado: cada quien ve solo sus logs.
   */
  @Get('me')
  async miActividad(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.buscarPorUsuario(user.id, {
      limite: limit ? parseInt(limit, 10) : 50,
    });
  }
}
