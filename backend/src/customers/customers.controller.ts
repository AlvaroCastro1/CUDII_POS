import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreditAccountDto } from './dto/credit-account.dto';
import { PaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

/** Controlador de clientes: CRUD, lealtad y crédito */
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /** Listar clientes con búsqueda y paginación */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
  ) {
    return this.customersService.findAll(
      user.empresaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      search,
      incluirInactivos === 'true',
    );
  }

  /** Detalle de cliente con puntos, historial y saldo */
  @Get(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('ventasPage') ventasPage: string = '1',
    @Query('ventasLimit') ventasLimit: string = '5',
  ) {
    return this.customersService.findOne(
      user.empresaId,
      id,
      parseInt(ventasPage, 10) || 1,
      parseInt(ventasLimit, 10) || 5,
    );
  }

  /** Crear cliente */
  @Post()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.create(user.empresaId, dto);
  }

  /** Actualizar cliente */
  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.update(user.empresaId, id, dto);
  }

  /** Soft delete de cliente */
  @Delete(':id')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.customersService.remove(user.empresaId, id);
  }

  /** Abrir cuenta de crédito con límite */
  @Post(':id/credit-account')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  openCreditAccount(
    @Param('id') id: string,
    @Body() dto: CreditAccountDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.openCreditAccount(user.empresaId, id, dto);
  }

  /** Registrar abono a deuda (aplicación FIFO) */
  @Post(':id/payment')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  registrarAbono(
    @Param('id') id: string,
    @Body() dto: PaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.registrarAbono(
      user.empresaId,
      id,
      dto,
      user.id,
    );
  }

  /** Estado de cuenta del cliente */
  @Get(':id/statement')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE)
  estadoDeCuenta(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.estadoDeCuenta(user.empresaId, id);
  }

  /** D11: Historial de movimientos de puntos (ganados / canjeados / expirados) */
  @Get(':id/points-history')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN, Rol.GERENTE, Rol.CAJERO)
  historialPuntos(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.historialMovimientosPuntos(
      user.empresaId,
      id,
    );
  }
}
