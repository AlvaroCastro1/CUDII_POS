import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createProductDto: CreateProductDto,
    empresaId: string,
    usuarioId: string,
  ) {
    // Validar código de barras único
    const existe = await this.prisma.producto.findFirst({
      where: {
        empresaId,
        codigoBarras: createProductDto.codigoBarras,
        estaActivo: true,
      },
    });
    if (existe) {
      throw new ConflictException(
        'Ya existe un producto activo con este código de barras',
      );
    }

    const { categoriasIds, preciosAdicionales, ...rest } = createProductDto;

    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.create({
        data: {
          ...rest,
          empresaId,
          categorias: categoriasIds?.length
            ? {
                connect: categoriasIds.map((id) => ({ id })),
              }
            : undefined,
        },
      });

      // Crear precios adicionales por unidad si se proporcionan
      if (preciosAdicionales && preciosAdicionales.length > 0) {
        await tx.precioPorUnidad.createMany({
          data: preciosAdicionales.map((pp) => ({
            ...pp,
            productoId: producto.id,
          })),
        });
      }

      // Inicializar stock en 0 para todas las sucursales de la empresa
      const empresa = await tx.empresa.findUnique({
        where: { id: empresaId },
        select: { stockMinimoGlobal: true, stockMaximoGlobal: true },
      });
      const sucursales = await tx.sucursal.findMany({ where: { empresaId } });
      if (sucursales.length > 0) {
        await tx.inventarioSucursal.createMany({
          data: sucursales.map((s) => ({
            productoId: producto.id,
            sucursalId: s.id,
            stockActual: 0,
            stockMinimo: empresa?.stockMinimoGlobal ?? 0,
            stockMaximo: empresa?.stockMaximoGlobal ?? 100,
          })),
        });
      }

      return producto;
    });
  }

  async findAll(
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    categoriaId = '',
    incluirInactivos = false,
  ) {
    const where: Prisma.ProductoWhereInput = { empresaId };

    if (!incluirInactivos) {
      where.estaActivo = true;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { codigoBarras: { contains: search, mode: 'insensitive' as const } },
        { codigoInterno: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (categoriaId) {
      where.categorias = {
        some: { id: categoriaId },
      };
    }

    const limitSafe = Math.min(limit, 100);
    const skip = (page - 1) * limitSafe;

    const [total, data] = await Promise.all([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        include: {
          categorias: true,
          preciosPorUnidad: { orderBy: { precio: 'asc' } },
          inventario: {
            select: {
              stockActual: true,
              stockMinimo: true,
              stockMaximo: true,
              sucursalId: true,
            },
          },
        },
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
            {
              codigoBarras: { contains: termino, mode: 'insensitive' as const },
            },
            {
              codigoInterno: {
                contains: termino,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : { empresaId, estaActivo: true };

    return this.prisma.producto.findMany({
      where,
      include: {
        categorias: true,
        inventario: {
          select: {
            stockActual: true,
            stockMinimo: true,
            stockMaximo: true,
            sucursalId: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
      take: limit,
    });
  }

  async findOne(id: string, empresaId: string, incluirInactivos = false) {
    const where: Prisma.ProductoWhereInput = { id, empresaId };
    if (!incluirInactivos) {
      where.estaActivo = true;
    }

    const producto = await this.prisma.producto.findFirst({
      where,
      include: {
        categorias: true,
        preciosPorUnidad: { orderBy: { precio: 'asc' } },
        inventario: {
          include: { sucursal: { select: { id: true, nombre: true } } },
        },
        movimientos: {
          orderBy: { fechaHora: 'desc' },
          take: 50,
          include: { usuario: { select: { id: true, nombre: true } } },
        },
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return producto;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    empresaId: string,
    usuarioId: string,
  ) {
    const productoAnterior = await this.findOne(id, empresaId, true);

    if (
      updateProductDto.codigoBarras &&
      updateProductDto.codigoBarras !== productoAnterior.codigoBarras
    ) {
      const existe = await this.prisma.producto.findFirst({
        where: {
          empresaId,
          codigoBarras: updateProductDto.codigoBarras,
          estaActivo: true,
        },
      });
      if (existe) {
        throw new ConflictException(
          'Ya existe un producto activo con este código de barras',
        );
      }
    }

    // Desestructuramos los campos de relación para no pasarlos directamente a Prisma
    const { categoriasIds, preciosAdicionales, ...camposProducto } =
      updateProductDto;

    return this.prisma.$transaction(async (tx) => {
      // Actualizar campos del producto (sin relaciones)
      const productoEditado = await tx.producto.update({
        where: { id },
        data: {
          ...camposProducto,
          // Si vienen categorías, reemplazar el set completo
          ...(categoriasIds !== undefined && {
            categorias: { set: categoriasIds.map((cid) => ({ id: cid })) },
          }),
        },
      });

      // Si vienen precios adicionales por unidad, reemplazar todos
      if (preciosAdicionales !== undefined) {
        await tx.precioPorUnidad.deleteMany({ where: { productoId: id } });
        if (preciosAdicionales.length > 0) {
          await tx.precioPorUnidad.createMany({
            data: preciosAdicionales.map((pp) => ({ ...pp, productoId: id })),
          });
        }
      }

      return productoEditado;
    });
  }

  async remove(id: string, empresaId: string) {
    await this.findOne(id, empresaId, true);

    // Soft delete — nunca se elimina físicamente
    return this.prisma.producto.update({
      where: { id },
      data: { estaActivo: false },
    });
  }
}
