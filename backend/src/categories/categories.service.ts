import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

  async findAll(empresaId: string) {
    return this.prisma.categoria.findMany({
      where: {
        empresaId,
        estaActivo: true,
      },
      orderBy: { nombre: 'asc' },
    });
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
