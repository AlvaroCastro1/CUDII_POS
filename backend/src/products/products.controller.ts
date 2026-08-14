import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.create(
      createProductDto,
      user.empresaId,
      user.id,
    );
  }

  @Get('search')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  search(
    @Query('q') q: string = '',
    @Query('limit') limit: string = '10',
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.search(q, parseInt(limit, 10), user.empresaId);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('categoriaId') categoriaId: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.findAll(
      user.empresaId,
      parseInt(page, 10),
      parseInt(limit, 10),
      search,
      categoriaId,
      incluirInactivos === 'true',
    );
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.findOne(id, user.empresaId);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      user.empresaId,
      user.id,
    );
  }

  @Delete(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.remove(id, user.empresaId);
  }
}
