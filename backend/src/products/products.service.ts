import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, empresaId: string, usuarioId: string) {
    const { categoriasIds, ...rest } = createProductDto;
    
    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.create({
        data: {
          ...rest,
          empresaId,
          categorias: categoriasIds?.length ? {
            connect: categoriasIds.map(id => ({ id }))
          } : undefined
        },
      });

      // Registrar historial de precios inicial
      await tx.historialPrecioProducto.create({
        data: {
          productoId: producto.id,
          usuarioId: usuarioId,
          precioAnterior: 0,
          precioNuevo: producto.precioVentaBase,
          tipoPrecio: 'base',
          motivo: 'Creación de producto',
        },
      });

      return producto;
    });
  }

  async findAll(empresaId: string) {
    return this.prisma.producto.findMany({
      where: {
        empresaId,
        estaActivo: true,
      },
      include: {
        categorias: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Búsqueda optimizada de productos por nombre, código de barras o código interno.
   * Devuelve un máximo de `limit` resultados para evitar cargar el catálogo completo.
   * @param q Término de búsqueda (mínimo 1 caracter)
   * @param limit Máximo de resultados a retornar (por defecto 10)
   * @param empresaId ID de la empresa autenticada
   */
  async search(q: string, limit: number, empresaId: string) {
    const termino = q.trim();

    // Si no hay término, devolver los primeros `limit` productos ordenados por nombre
    const where = termino
      ? {
          empresaId,
          estaActivo: true,
          OR: [
            { nombre: { contains: termino, mode: 'insensitive' as const } },
            { codigoBarras: { contains: termino, mode: 'insensitive' as const } },
            { codigoInterno: { contains: termino, mode: 'insensitive' as const } },
          ],
        }
      : { empresaId, estaActivo: true };

    return this.prisma.producto.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        codigoBarras: true,
        codigoInterno: true,
        unidadMedida: true,
        esGranel: true,
        precioVentaBase: true,
        precioCompra: true,
      },
      orderBy: { nombre: 'asc' },
      take: limit,
    });
  }


  async findOne(id: string, empresaId: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, empresaId, estaActivo: true },
      include: {
        categorias: true,
        historialPrecios: {
          orderBy: { fechaHora: 'desc' },
          take: 5,
        }
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return producto;
  }

  async update(id: string, updateProductDto: UpdateProductDto, empresaId: string, usuarioId: string) {
    const productoAnterior = await this.findOne(id, empresaId);

    return this.prisma.$transaction(async (tx) => {
      const productoEditado = await tx.producto.update({
        where: { id },
        data: updateProductDto,
      });

      // Si el precio cambió, registrar en el historial
      if (updateProductDto.precioVentaBase !== undefined && updateProductDto.precioVentaBase !== productoAnterior.precioVentaBase) {
        await tx.historialPrecioProducto.create({
          data: {
            productoId: productoEditado.id,
            usuarioId: usuarioId,
            precioAnterior: productoAnterior.precioVentaBase,
            precioNuevo: updateProductDto.precioVentaBase,
            tipoPrecio: 'base',
            motivo: 'Actualización de producto',
          },
        });
      }

      return productoEditado;
    });
  }

  async remove(id: string, empresaId: string) {
    await this.findOne(id, empresaId);

    // Soft delete
    return this.prisma.producto.update({
      where: { id },
      data: { estaActivo: false },
    });
  }
}
