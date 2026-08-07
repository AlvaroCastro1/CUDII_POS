import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, empresaId: string, usuarioId: string) {
    // Validar código de barras único
    const existe = await this.prisma.producto.findFirst({
      where: { empresaId, codigoBarras: createProductDto.codigoBarras, estaActivo: true },
    });
    if (existe) {
      throw new ConflictException('Ya existe un producto activo con este código de barras');
    }

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

      // Inicializar stock en 0 para todas las sucursales de la empresa
      const sucursales = await tx.sucursal.findMany({ where: { empresaId } });
      if (sucursales.length > 0) {
        await tx.inventarioSucursal.createMany({
          data: sucursales.map(s => ({
            productoId: producto.id,
            sucursalId: s.id,
            stockActual: 0,
            stockMaximo: 0,
            stockMinimo: 0,
          }))
        });
      }

      return producto;
    });
  }

  async findAll(empresaId: string, page = 1, limit = 20, search = '', categoriaId = '', incluirInactivos = false) {
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
        some: { id: categoriaId }
      };
    }

    const limitSafe = Math.min(limit, 100);
    const skip = (page - 1) * limitSafe;

    const [total, data] = await Promise.all([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        include: { categorias: true },
        orderBy: { nombre: 'asc' },
        skip,
        take: limitSafe,
      }),
    ]);

    const totalPages = Math.ceil(total / limitSafe);

    console.log(`[findAll] incluirInactivos: ${incluirInactivos}, count: ${data.length}`);

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


  async findOne(id: string, empresaId: string, incluirInactivos = false) {
    const where: Prisma.ProductoWhereInput = { id, empresaId };
    if (!incluirInactivos) {
      where.estaActivo = true;
    }

    const producto = await this.prisma.producto.findFirst({
      where,
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
    const productoAnterior = await this.findOne(id, empresaId, true);

    if (updateProductDto.codigoBarras && updateProductDto.codigoBarras !== productoAnterior.codigoBarras) {
      const existe = await this.prisma.producto.findFirst({
        where: { empresaId, codigoBarras: updateProductDto.codigoBarras, estaActivo: true },
      });
      if (existe) {
        throw new ConflictException('Ya existe un producto activo con este código de barras');
      }
    }

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
    await this.findOne(id, empresaId, true);

    // Soft delete
    return this.prisma.producto.update({
      where: { id },
      data: { estaActivo: false },
    });
  }
}
