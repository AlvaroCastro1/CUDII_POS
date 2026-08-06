import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getStock(sucursalId: string, empresaId: string) {
    let whereClause: any = { sucursalId };
    
    if (sucursalId === 'all') {
      const sucursales = await this.prisma.sucursal.findMany({ where: { empresaId } });
      if (sucursales.length === 0) return [];
      whereClause = { sucursalId: { in: sucursales.map(s => s.id) } };
    } else {
      const sucursal = await this.prisma.sucursal.findFirst({
        where: { id: sucursalId, empresaId },
      });
      if (!sucursal) {
        throw new NotFoundException('Sucursal no encontrada');
      }
    }

    return this.prisma.inventarioSucursal.findMany({
      where: whereClause,
      include: {
        producto: true,
        sucursal: true,
      },
    });
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

      const tipoMovimiento = cantidad > 0 ? 'ajuste_positivo' : 'ajuste_negativo';

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
