import { Controller, Get, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

/** Controlador de empresas: información de la empresa del usuario autenticado */
@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * Sucursales de la empresa del usuario autenticado.
   * GET /companies/my/sucursales
   */
  @Get('my/sucursales')
  misSucursales(@CurrentUser() user: CurrentUserPayload) {
    return this.companiesService.listarSucursales(user.empresaId);
  }
}
