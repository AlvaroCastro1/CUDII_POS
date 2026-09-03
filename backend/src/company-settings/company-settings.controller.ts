import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('company-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  /**
   * Configuración completa del sitio (solo ADMIN/SUPER_ADMIN).
   * Incluye el bloque del Programa de Lealtad (D10) con sus niveles.
   */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  async getSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getSettings(user.empresaId);
  }

  @Patch()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  async updateSettings(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.companySettingsService.updateSettings(user.empresaId, dto);
  }

  /**
   * D10: Configuración del Programa de Lealtad accesible a todos los roles
   * autenticados. El POS la necesita para mostrar puntos, niveles y descuentos.
   * Solo lectura; la edición sigue restringida al PATCH anterior.
   */
  @Get('lealtad')
  async getProgramaLealtad(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getProgramaLealtad(user.empresaId);
  }

  /**
   * Configuración de estilos de tickets accesible a todos los usuarios autenticados
   * para el formateo de comprobantes e impresión en terminales POS.
   */
  @Get('ticket')
  async getConfiguracionTicket(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getConfiguracionTicket(user.empresaId);
  }
}
