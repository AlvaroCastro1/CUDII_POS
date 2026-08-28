import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '@prisma/client';
import { CrearDevolucionDto } from './dto/crear-devolucion.dto';

@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async createReturn(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CrearDevolucionDto,
  ) {
    return this.returnsService.createReturn(
      user.id,
      user.empresaId,
      dto,
    );
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CONTADOR)
  async findAllReturns(@CurrentUser() user: CurrentUserPayload) {
    return this.returnsService.findAllReturns(user.empresaId);
  }
}
