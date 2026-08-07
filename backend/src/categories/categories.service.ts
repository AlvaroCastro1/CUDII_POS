import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto, empresaId: string) {
    return this.prisma.categoria.create({
      data: {
        ...createCategoryDto,
        empresaId,
      },
    });
  }

  async findAll(empresaId: string, page = 1, limit = 20, search = '') {
    const where: Prisma.CategoriaWhereInput = { empresaId, estaActivo: true };
    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' as const };
    }
    const limitSafe = Math.min(limit, 100);
    const skip = (page - 1) * limitSafe;
    const [total, data] = await Promise.all([
      this.prisma.categoria.count({ where }),
      this.prisma.categoria.findMany({ where, orderBy: { nombre: 'asc' }, skip, take: limitSafe }),
    ]);
    const totalPages = Math.ceil(total / limitSafe);
    return {
      data,
      meta: { total, page, limit: limitSafe, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async findOne(id: string, empresaId: string) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id, empresaId, estaActivo: true },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return categoria;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto, empresaId: string) {
    await this.findOne(id, empresaId);

    return this.prisma.categoria.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: string, empresaId: string) {
    await this.findOne(id, empresaId);

    // Verificar si hay productos activos asociados
    const productosAsociados = await this.prisma.producto.count({
      where: {
        categorias: { some: { id } },
        estaActivo: true,
      },
    });

    if (productosAsociados > 0) {
      throw new ConflictException(
        `No se puede eliminar la categoría porque tiene ${productosAsociados} producto(s) asociado(s).`,
      );
    }

    return this.prisma.categoria.update({
      where: { id },
      data: { estaActivo: false },
    });
  }
}
