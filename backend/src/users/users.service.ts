import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, empresaId: string) {
    if (createUserDto.rol === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'No está permitido crear usuarios con rol SUPER_ADMIN desde esta interfaz.',
      );
    }

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
      },
    });
  }

  async findAll(
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    incluirInactivos = false,
  ) {
    const where: Prisma.UsuarioWhereInput = { empresaId };

    // Por defecto ocultamos inactivos, a menos que el usuario los pida
    if (!incluirInactivos) {
      where.estaActivo = true;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    const limitSafe = Math.min(limit, 100);
    const skip = (page - 1) * limitSafe;
    const selectFields = {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      estaActivo: true,
      creadoEn: true,
    };
    const [total, data] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: selectFields,
        orderBy: { nombre: 'asc' },
        skip,
        take: limitSafe,
      }),
    ]);
    const totalPages = Math.ceil(total / limitSafe);
    return {
      data,
      meta: {
        total,
        page,
        limit: limitSafe,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findAuthorizers(empresaId: string) {
    return this.prisma.usuario.findMany({
      where: {
        empresaId,
        estaActivo: true,
        rol: { in: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'] },
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
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
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async update(id: string, updateUserDto: UpdateUserDto, empresaId: string) {
    const usuario = await this.findOne(id, empresaId);

    if (usuario.rol === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'No estás autorizado para modificar a un SUPER_ADMIN.',
      );
    }

    if (updateUserDto.rol === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'No está permitido asignar el rol SUPER_ADMIN.',
      );
    }

    const updateData: Prisma.UsuarioUpdateInput = {
      ...(updateUserDto.nombre !== undefined
        ? { nombre: updateUserDto.nombre }
        : {}),
      ...(updateUserDto.email !== undefined
        ? { email: updateUserDto.email }
        : {}),
      ...(updateUserDto.rol !== undefined ? { rol: updateUserDto.rol } : {}),
      ...(updateUserDto.estaActivo !== undefined
        ? { estaActivo: updateUserDto.estaActivo }
        : {}),
    };

    if (updateUserDto.password) {
      updateData.passwordHash = await argon2.hash(updateUserDto.password);
    }

    if (updateUserDto.email) {
      const emailExistente = await this.prisma.usuario.findFirst({
        where: { email: updateUserDto.email, id: { not: id } },
      });
      if (emailExistente) {
        throw new ConflictException(
          'El correo electrónico ya está registrado en otra cuenta',
        );
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
      },
    });
  }

  async remove(id: string, empresaId: string) {
    const usuario = await this.findOne(id, empresaId);

    if (usuario.rol === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'No estás autorizado para desactivar a un SUPER_ADMIN.',
      );
    }

    return this.prisma.usuario.update({
      where: { id },
      data: { estaActivo: false },
      select: {
        id: true,
        nombre: true,
        estaActivo: true,
      },
    });
  }
}
