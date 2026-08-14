import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { RetiroParcialDto } from './dto/retiro-parcial.dto';
import { CorteZDto } from './dto/corte-z.dto';

/**
 * Controlador del módulo de Caja Registradora.
 * Gestiona el ciclo de vida completo de una sesión de caja:
 * apertura → retiros parciales → corte X → corte Z (cierre).
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
  async getSettings(@Request() req: { user: { empresaId: string } }) {
    return this.cashRegisterService.getSettings(req.user.empresaId);
  }

  /**
   * Obtener la sesión de caja activa del usuario o de una caja específica.
   * GET /cash-register/current?cajaId=xxx
   */
  @Get('current')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async getCurrentSession(
    @Request() req: { user: { id: string; empresaId: string } },
    @Query('cajaId') cajaId?: string,
  ) {
    return this.cashRegisterService.getCurrentSession(req.user.id, cajaId);
  }

  /**
   * Abrir una nueva sesión de caja con fondo inicial.
   * POST /cash-register/open
   */
  @Post('open')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async openSession(
    @Request() req: { user: { id: string; empresaId: string } },
    @Body() dto: AbrirCajaDto,
  ) {
    return this.cashRegisterService.openSession(
      req.user.id,
      req.user.empresaId,
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
    @Request() req: { user: { id: string; empresaId: string } },
    @Body() dto: RetiroParcialDto,
  ) {
    return this.cashRegisterService.addWithdrawal(
      req.user.id,
      req.user.empresaId,
      dto,
    );
  }

  /**
   * Generar un Corte X (informativo, no cierra la sesión).
   * POST /cash-register/close-x
   */
  @Post('close-x')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async generateCorteX(
    @Request() req: { user: { id: string; empresaId: string } },
    @Body('sesionCajaId') sesionCajaId: string,
  ) {
    return this.cashRegisterService.generateCorteX(
      req.user.id,
      req.user.empresaId,
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
    @Request() req: { user: { id: string; empresaId: string } },
    @Body() dto: CorteZDto,
  ) {
    return this.cashRegisterService.closeSessionZ(
      req.user.id,
      req.user.empresaId,
      dto,
    );
  }
}
