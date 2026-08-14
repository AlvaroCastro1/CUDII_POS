import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearDevolucionDto } from './dto/crear-devolucion.dto';
import { DestinoDevolucion, TipoMovimientoInventario } from '@prisma/client';

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesar una devolución de venta
   */
  async createReturn(
    usuarioId: string,
    empresaId: string,
    dto: CrearDevolucionDto,
  ) {
    const venta = await this.prisma.venta.findFirst({
      where: {
        id: dto.ventaId,
        empresaId,
      },
      include: {
        detalles: true,
        devoluciones: {
          include: { productos: true },
        },
      },
    });

    if (!venta) {
      throw new NotFoundException('La venta especificada no fue encontrada');
    }

    if (venta.estado === 'cancelada') {
      throw new BadRequestException(
        'No se pueden procesar devoluciones sobre una venta cancelada',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generar folio para la devolución
      const totalDevolucionesPrevias = await tx.devolucion.count({
        where: { venta: { empresaId } },
      });
      const folio = `DEV-${String(totalDevolucionesPrevias + 1).padStart(6, '0')}`;

      let totalDevuelto = 0;
      const itemsDevolucionData = [];

      for (const item of dto.productos) {
        const detalleOriginal = venta.detalles.find(
          (d) => d.productoId === item.productoId,
        );

        if (!detalleOriginal) {
          throw new BadRequestException(
            `El producto ${item.productoId} no forma parte de la venta original`,
          );
        }

        // Calcular cantidad previamente devuelta de este producto
        const yaDevuelto = venta.devoluciones.reduce((acc, dev) => {
          const itemDev = dev.productos.find(
            (p) => p.productoId === item.productoId,
          );
          return acc + (itemDev ? itemDev.cantidadDevuelta : 0);
        }, 0);

        if (yaDevuelto + item.cantidadDevuelta > detalleOriginal.cantidad) {
          throw new BadRequestException(
            `La cantidad a devolver de este producto excede lo comprado originalmente`,
          );
        }

        const subtotalItem = item.cantidadDevuelta * item.precioUnitario;
        totalDevuelto += subtotalItem;

        itemsDevolucionData.push({
          productoId: item.productoId,
          cantidadDevuelta: item.cantidadDevuelta,
          precioUnitario: item.precioUnitario,
          subtotal: subtotalItem,
          motivo: item.motivo,
          destino: item.destino,
        });

        // Manejo de Inventario según Destino (stock vs merma)
        let inventario = await tx.inventarioSucursal.findUnique({
          where: {
            sucursalId_productoId: {
              sucursalId: venta.sucursalId,
              productoId: item.productoId,
            },
          },
        });

        if (!inventario) {
          inventario = await tx.inventarioSucursal.create({
            data: {
              sucursalId: venta.sucursalId,
              productoId: item.productoId,
              stockActual: 0,
            },
          });
        }

        const stockAnterior = inventario.stockActual;

        if (item.destino === DestinoDevolucion.stock) {
          const stockNuevo = stockAnterior + item.cantidadDevuelta;

          await tx.inventarioSucursal.update({
            where: { id: inventario.id },
            data: {
              stockActual: stockNuevo,
              ultimoMovimiento: new Date(),
            },
          });

          await tx.movimientoInventario.create({
            data: {
              productoId: item.productoId,
              sucursalId: venta.sucursalId,
              tipo: TipoMovimientoInventario.devolucion_venta,
              cantidad: item.cantidadDevuelta,
              stockAnterior,
              stockNuevo,
              referencia: folio,
              motivo: `Devolución a stock - Venta ${venta.folio}`,
              usuarioId,
            },
          });
        } else {
          // Destino: merma (no reintegra al stock vendible)
          await tx.movimientoInventario.create({
            data: {
              productoId: item.productoId,
              sucursalId: venta.sucursalId,
              tipo: TipoMovimientoInventario.ajuste_negativo,
              cantidad: item.cantidadDevuelta,
              stockAnterior,
              stockNuevo: stockAnterior,
              referencia: folio,
              motivo: `Devolución a merma (${item.motivo}) - Venta ${venta.folio}`,
              usuarioId,
            },
          });
        }
      }

      // 2. Crear cabecera Devolución
      const devolucion = await tx.devolucion.create({
        data: {
          ventaId: dto.ventaId,
          usuarioId,
          sesionCajaId: dto.sesionCajaId,
          folio,
          totalDevuelto,
          tipoResolucion: dto.tipoResolucion,
          motivoGeneral: dto.motivoGeneral,
          productos: {
            create: itemsDevolucionData,
          },
        },
        include: {
          productos: true,
          venta: true,
        },
      });

      return devolucion;
    });
  }

  /**
   * Listar devoluciones de la empresa
   */
  async findAllReturns(empresaId: string) {
    return this.prisma.devolucion.findMany({
      where: {
        venta: { empresaId },
      },
      orderBy: { fechaHora: 'desc' },
      include: {
        productos: {
          include: { producto: true },
        },
        venta: { select: { id: true, folio: true } },
        usuario: { select: { id: true, nombre: true } },
      },
    });
  }
}
