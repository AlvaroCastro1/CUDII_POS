import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Rol } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('products')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  create(@Body() createProductDto: CreateProductDto, @CurrentUser() user: CurrentUserPayload) {
    // Forzamos a que el producto se cree en la empresa del usuario
    createProductDto.empresaId = user.empresaId;
    return this.inventoryService.createProduct(createProductDto);
  }

  @Get('products')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN, Rol.CAJERO)
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.inventoryService.findAllProducts(user.empresaId);
  }

  @Get('products/:id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN, Rol.CAJERO)
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.inventoryService.findOneProduct(id, user.empresaId);
  }

  @Patch('products/:id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN)
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @CurrentUser() user: CurrentUserPayload) {
    return this.inventoryService.updateProduct(id, updateProductDto, user.empresaId);
  }

  @Delete('products/:id')
  @Roles(Rol.ADMIN, Rol.GERENTE) // ALMACEN no puede borrar, solo GERENTE y ADMIN
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.inventoryService.removeProduct(id, user.empresaId);
  }
}
