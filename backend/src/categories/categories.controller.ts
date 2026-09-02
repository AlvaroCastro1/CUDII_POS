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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.GERENTE)
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.categoriesService.create(createCategoryDto, user.empresaId);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN, Rol.CONTADOR)
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('incluirInactivos') incluirInactivos: string = 'false',
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.categoriesService.findAll(
      user.empresaId,
      parseInt(page, 10),
      parseInt(limit, 10),
      search,
      incluirInactivos === 'true',
    );
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.ALMACEN)
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.categoriesService.findOne(id, user.empresaId, true);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, user.empresaId);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.categoriesService.remove(id, user.empresaId);
  }
}
