import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '@prisma/client';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { RetiroParcialDto } from './dto/retiro-parcial.dto';
import { CorteZDto } from './dto/corte-z.dto';

import { RegistrarEgresoDto } from './dto/registrar-egreso.dto';

/**
 * Controlador del módulo de Caja Registradora.
 * Gestiona el ciclo de vida completo de una sesión de caja:
 * apertura → retiros parciales → egresos → corte X → corte Z (cierre).
 */
@Controller('cash-register')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  /**
   * Obtener la configuración de cortes de la empresa (modo Corte Z y umbral
   * de faltante crítico) para el terminal POS.
   * GET /cash-register/settings
   */
  @Get('settings')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async getSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.cashRegisterService.getSettings(user.empresaId);
  }

  /**
   * Obtener todas las sesiones de caja abiertas de la empresa (vista de
   * administración). GET /cash-register/open-sessions
   */
  @Get('open-sessions')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  async getOpenSessions(@CurrentUser() user: CurrentUserPayload) {
    return this.cashRegisterService.listarSesionesAbiertas(user.empresaId);
  }

  /**
   * Previsualizar el corte Z de una sesión abierta sin cerrarla.
   * GET /cash-register/sessions/:id/preview
   */
  @Get('sessions/:id/preview')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  async previewCorteZ(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sesionCajaId: string,
  ) {
    return this.cashRegisterService.previsualizarCorteZ(
      user.empresaId,
      sesionCajaId,
    );
  }

  /**
   * Obtener la sesión de caja activa del usuario o de una caja específica.
   * GET /cash-register/current?cajaId=xxx
   */
  @Get('current')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async getCurrentSession(
    @CurrentUser() user: CurrentUserPayload,
    @Query('cajaId') cajaId?: string,
  ) {
    return this.cashRegisterService.getCurrentSession(user.id, cajaId);
  }

  /**
   * Abrir una nueva sesión de caja con fondo inicial.
   * POST /cash-register/open
   */
  @Post('open')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async openSession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AbrirCajaDto,
  ) {
    return this.cashRegisterService.openSession(
      user.id,
      user.empresaId,
      dto,
    );
  }

  /**
   * Registrar un retiro parcial de efectivo.
   * POST /cash-register/withdrawal
   */
  @Post('withdrawal')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async addWithdrawal(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RetiroParcialDto,
  ) {
    return this.cashRegisterService.addWithdrawal(
      user.id,
      user.empresaId,
      dto,
    );
  }

  /**
   * Registrar un egreso o gasto directo de caja.
   * POST /cash-register/expenses
   */
  @Post('expenses')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async addExpense(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegistrarEgresoDto,
  ) {
    return this.cashRegisterService.addExpense(
      user.id,
      user.empresaId,
      dto,
    );
  }

  /**
   * Obtener los egresos registrados de una sesión de caja.
   * GET /cash-register/expenses/:sesionCajaId
   */
  @Get('expenses/:sesionCajaId')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async getExpenses(@Param('sesionCajaId') sesionCajaId: string) {
    return this.cashRegisterService.getExpenses(sesionCajaId);
  }

  /**
   * Generar un Corte X (informativo, no cierra la sesión).
   * POST /cash-register/close-x
   */
  @Post('close-x')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async generateCorteX(
    @CurrentUser() user: CurrentUserPayload,
    @Body('sesionCajaId') sesionCajaId: string,
  ) {
    return this.cashRegisterService.generateCorteX(
      user.id,
      user.empresaId,
      sesionCajaId,
    );
  }

  /**
   * Cerrar el turno de caja (Corte Z) con manejo de discrepancias.
   * POST /cash-register/close-z
   */
  @Post('close-z')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async closeSessionZ(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CorteZDto,
  ) {
    return this.cashRegisterService.closeSessionZ(
      user.id,
      user.empresaId,
      dto,
    );
  }
}

