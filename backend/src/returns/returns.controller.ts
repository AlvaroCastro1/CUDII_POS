import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CrearDevolucionDto } from './dto/crear-devolucion.dto';
import { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO)
  async createReturn(
    @Request() req: { user: CurrentUserPayload },
    @Body() dto: CrearDevolucionDto,
  ) {
    return this.returnsService.createReturn(
      req.user.id,
      req.user.empresaId,
      dto,
    );
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CONTADOR)
  async findAllReturns(@Request() req: { user: CurrentUserPayload }) {
    return this.returnsService.findAllReturns(req.user.empresaId);
  }
}
