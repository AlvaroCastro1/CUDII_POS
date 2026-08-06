import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Rol.ADMIN) // Solo el administrador de la empresa puede crear usuarios
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.create(createUserDto, user.empresaId);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE)
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.usersService.findAll(user.empresaId, parseInt(page, 10), parseInt(limit, 10), search);
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findOne(id, user.empresaId);
  }

  @Patch('profile/me')
  updateProfile(@Body() updateUserDto: UpdateUserDto, @CurrentUser() user: CurrentUserPayload) {
    // Evitar escalada de privilegios
    delete updateUserDto.rol;
    delete updateUserDto.estaActivo;
    return this.usersService.update(user.id, updateUserDto, user.empresaId);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.update(id, updateUserDto, user.empresaId);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.empresaId);
  }
}
