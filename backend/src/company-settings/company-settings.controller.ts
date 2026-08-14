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
}
