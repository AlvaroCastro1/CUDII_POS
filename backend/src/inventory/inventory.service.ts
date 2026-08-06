import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoMovimientoInventario } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getStock(sucursalId: string, empresaId: string, page = 1, limit = 20, search = '') {
    let whereClause: any = { sucursalId };
    
    if (sucursalId === 'all') {
      const sucursales = await this.prisma.sucursal.findMany({ where: { empresaId } });
      if (sucursales.length === 0) return { data: [], meta: { total: 0, page: 1, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      whereClause = { sucursalId: { in: sucursales.map(s => s.id) } };
    } else {
      const sucursal = await this.prisma.sucursal.findFirst({
        where: { id: sucursalId, empresaId },
      });
      if (!sucursal) {
        throw new NotFoundException('Sucursal no encontrada');
      }
    }

    if (search) {
      whereClause.producto = {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' as const } },
          { codigoBarras: { contains: search, mode: 'insensitive' as const } },
          { codigoInterno: { contains: search, mode: 'insensitive' as const } }
        ]
      };
    }

    const limitSafe = Math.min(limit, 100);
    const skip = (page - 1) * limitSafe;

    const [total, data] = await Promise.all([
      this.prisma.inventarioSucursal.count({ where: whereClause }),
      this.prisma.inventarioSucursal.findMany({
        where: whereClause,
        include: {
          producto: true,
          sucursal: true,
        },
        skip,
        take: limitSafe,
      })
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

  async adjustStock(
    data: { productoId: string; sucursalId: string; cantidad: number; motivo: string },
    empresaId: string,
    usuarioId: string
  ) {
    const { productoId, cantidad, motivo } = data;
    let { sucursalId } = data;

    // Si no viene sucursalId, usar la primera sucursal de la empresa
    if (!sucursalId) {
      const primeraSuccursal = await this.prisma.sucursal.findFirst({
        where: { empresaId },
      });
      if (!primeraSuccursal) {
        throw new NotFoundException('No se encontró ninguna sucursal para esta empresa');
      }
      sucursalId = primeraSuccursal.id;
    }

    // Validar producto
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, empresaId, estaActivo: true },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Validar sucursal
    const sucursal = await this.prisma.sucursal.findFirst({
      where: { id: sucursalId, empresaId },
    });
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return this.prisma.$transaction(async (tx) => {
      let inventario = await tx.inventarioSucursal.findUnique({
        where: {
          sucursalId_productoId: { sucursalId, productoId },
        },
      });

      const stockAnterior = inventario ? inventario.stockActual : 0;
      const stockNuevo = stockAnterior + cantidad;

      if (stockNuevo < 0 && !producto.esGranel) {
        throw new BadRequestException('El stock no puede ser negativo');
      }

      if (inventario) {
        inventario = await tx.inventarioSucursal.update({
          where: { sucursalId_productoId: { sucursalId, productoId } },
          data: { stockActual: stockNuevo },
        });
      } else {
        inventario = await tx.inventarioSucursal.create({
          data: {
            productoId,
            sucursalId,
            stockActual: stockNuevo,
          },
        });
      }

      const tipoMovimiento = cantidad > 0 
        ? TipoMovimientoInventario.ajuste_positivo 
        : TipoMovimientoInventario.ajuste_negativo;

      await tx.movimientoInventario.create({
        data: {
          productoId,
          sucursalId,
          tipo: tipoMovimiento,
          cantidad: Math.abs(cantidad),
          stockAnterior,
          stockNuevo,
          motivo,
          usuarioId,
        },
      });

      return inventario;
    });
  }
}
