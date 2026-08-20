import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MermaService } from './merma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CrearMermaDto } from './dto/crear-merma.dto';
import { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('merma')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MermaController {
  constructor(private readonly mermaService: MermaService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE)
  async registrarMerma(
    @Request() req: { user: CurrentUserPayload },
    @Body() dto: CrearMermaDto,
  ) {
    return this.mermaService.registrarMerma(
      dto,
      req.user.empresaId,
      req.user.id,
    );
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CONTADOR)
  async findAllMermas(
    @Request() req: { user: CurrentUserPayload },
    @Query('sucursalId') sucursalId?: string,
    @Query('productoId') productoId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.mermaService.findAllMermas(req.user.empresaId, {
      sucursalId,
      productoId,
      desde,
      hasta,
    });
  }
}
