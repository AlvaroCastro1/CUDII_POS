import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, empresaId: string) {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { email: createUserDto.email },
    });

    if (usuarioExistente) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const { password, ...userData } = createUserDto;
    const hashedPassword = await argon2.hash(password);

    return this.prisma.usuario.create({
      data: {
        ...userData,
        passwordHash: hashedPassword,
        empresaId,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estaActivo: true,

        creadoEn: true,
      }
    });
  }

  async findAll(empresaId: string) {
    return this.prisma.usuario.findMany({
      where: { empresaId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estaActivo: true,

        creadoEn: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string, empresaId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estaActivo: true,

      }
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async update(id: string, updateUserDto: UpdateUserDto, empresaId: string) {
    await this.findOne(id, empresaId);

    const updateData: any = { ...updateUserDto };

    if (updateUserDto.password) {
      updateData.passwordHash = await argon2.hash(updateUserDto.password);
      delete updateData.password;
    }

    if (updateUserDto.email) {
      const emailExistente = await this.prisma.usuario.findFirst({
        where: { email: updateUserDto.email, id: { not: id } }
      });
      if (emailExistente) {
        throw new ConflictException('El correo electrónico ya está registrado en otra cuenta');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estaActivo: true,

      }
    });
  }

  async remove(id: string, empresaId: string) {
    await this.findOne(id, empresaId);

    return this.prisma.usuario.update({
      where: { id },
      data: { estaActivo: false },
      select: {
        id: true,
        nombre: true,
        estaActivo: true,
      }
    });
  }
}
