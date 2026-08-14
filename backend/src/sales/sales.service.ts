import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { MetodoPago, Prisma, TipoMovimientoInventario } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registrar una venta (Transacción atómica POS)
   */
  async createSale(cajeroId: string, empresaId: string, dto: CrearVentaDto) {
    // 1. Validar que la Sesión de Caja existe y está abierta
    const sesion = await this.prisma.sesionCaja.findFirst({
      where: {
        id: dto.sesionCajaId,
        estado: 'abierta',
      },
      include: { caja: true },
    });

    if (!sesion) {
      throw new BadRequestException(
        'No hay una sesión de caja abierta válida para esta operación',
      );
    }

    // Derivar cajaId y sucursalId desde la sesión si no vienen en el DTO
    const cajaId = dto.cajaId || sesion.cajaId;
    const sucursalId = dto.sucursalId || sesion.caja?.sucursalId;

    if (!cajaId || !sucursalId) {
      throw new BadRequestException(
        'No se pudo identificar la caja o sucursal asociada a la sesión',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Incrementar la secuencia de folio de la caja atómicamente
      const cajaActualizada = await tx.caja.update({
        where: { id: cajaId },
        data: { secuenciaFolio: { increment: 1 } },
      });

      const codigoCaja =
        cajaActualizada.codigo ||
        `CJ${cajaActualizada.id.slice(0, 4).toUpperCase()}`;
      const numeroSecuencia = String(cajaActualizada.secuenciaFolio).padStart(
        6,
        '0',
      );
      const folio = `${codigoCaja}-${numeroSecuencia}`;

      // 3. Procesar ítems y calcular totales
      let subtotalVenta = 0;
      let descuentoVenta = dto.descuentoGeneral || 0;
      const impuestosVenta = 0;

      const detallesData = [];
      const detallesList = dto.detalles;

      for (const item of detallesList) {
        const producto = await tx.producto.findFirst({
          where: { id: item.productoId, empresaId },
        });

        if (!producto) {
          throw new NotFoundException(
            `El producto con ID ${item.productoId} no fue encontrado`,
          );
        }

        const subtotalItem = item.cantidad * item.precioUnitario;
        const descuentoItem = item.descuento || 0;
        const totalItem = subtotalItem - descuentoItem;

        subtotalVenta += subtotalItem;
        descuentoVenta += descuentoItem;

        detallesData.push({
          productoId: item.productoId,
          nombreProducto: producto.nombre,
          unidadMedida: item.unidadMedida || producto.unidadMedida,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          costoHistorico: producto.precioCompra || 0,
          subtotal: subtotalItem,
          descuento: descuentoItem,
          impuestos: 0,
          total: totalItem,
        });

        // Descontar inventario (Permisivo: se permite stock negativo con registro auditado)
        if (producto.manejaInventario) {
          let inventario = await tx.inventarioSucursal.findUnique({
            where: {
              sucursalId_productoId: {
                sucursalId,
                productoId: item.productoId,
              },
            },
          });

          if (!inventario) {
            inventario = await tx.inventarioSucursal.create({
              data: {
                sucursalId,
                productoId: item.productoId,
                stockActual: 0,
              },
            });
          }

          const stockAnterior = inventario.stockActual;
          const stockNuevo = stockAnterior - item.cantidad;

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
              sucursalId,
              tipo: TipoMovimientoInventario.venta,
              cantidad: item.cantidad,
              stockAnterior,
              stockNuevo,
              referencia: folio,
              motivo: `Venta POS - Folio ${folio}`,
              usuarioId: cajeroId,
            },
          });
        }
      }

      const totalVenta = subtotalVenta - descuentoVenta + impuestosVenta;

      // 4. Procesar pagos y actualizar acumulación en SesionCaja
      let acumuladoEfectivo = 0;
      let acumuladoTarjeta = 0;
      let acumuladoOtros = 0;

      const pagosData = dto.pagos.map((pago) => {
        const metodoEnum =
          pago.metodo === MetodoPago.tarjeta
            ? MetodoPago.tarjeta
            : MetodoPago.efectivo;
        const montoRecibido = pago.montoRecibido;
        const montoPagado = pago.montoPagado;
        const cambio = pago.cambio ?? 0;

        if (metodoEnum === MetodoPago.efectivo) {
          acumuladoEfectivo += montoPagado;
        } else if (metodoEnum === MetodoPago.tarjeta) {
          acumuladoTarjeta += montoPagado;
        } else {
          acumuladoOtros += montoPagado;
        }

        return {
          metodo: metodoEnum,
          montoRecibido,
          montoPagado,
          cambio,
          referencia: pago.referencia || undefined,
        };
      });

      await tx.sesionCaja.update({
        where: { id: dto.sesionCajaId },
        data: {
          totalVentasEfectivo: { increment: acumuladoEfectivo },
          totalVentasTarjeta: { increment: acumuladoTarjeta },
          totalVentasOtros: { increment: acumuladoOtros },
        },
      });

      // 5. Crear Venta cabecera
      const venta = await tx.venta.create({
        data: {
          empresaId,
          sucursalId,
          cajaId,
          sesionCajaId: dto.sesionCajaId,
          cajeroId,
          folio,
          secuenciaFolio: cajaActualizada.secuenciaFolio,
          subtotal: subtotalVenta,
          descuento: descuentoVenta,
          impuestos: impuestosVenta,
          total: totalVenta,
          estado: 'completada',
          notas: dto.notas,
          detalles: {
            create: detallesData,
          },
          pagos: {
            create: pagosData,
          },
        },
        include: {
          detalles: true,
          pagos: true,
          cajero: {
            select: { id: true, nombre: true },
          },
          caja: true,
        },
      });

      return venta;
    });
  }

  /**
   * Listar ventas con paginación y filtros
   */
  async findAllSales(
    empresaId: string,
    query: {
      sucursalId?: string;
      sesionCajaId?: string;
      cajeroId?: string;
      fechaInicio?: string;
      fechaFin?: string;
      pagina?: number;
      limite?: number;
    },
  ) {
    const pagina = Number(query.pagina) || 1;
    const limite = Number(query.limite) || 20;
    const skip = (pagina - 1) * limite;

    const where: Prisma.VentaWhereInput = { empresaId };

    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.sesionCajaId) where.sesionCajaId = query.sesionCajaId;
    if (query.cajeroId) where.cajeroId = query.cajeroId;

    if (query.fechaInicio || query.fechaFin) {
      where.creadoEn = {};
      if (query.fechaInicio) where.creadoEn.gte = new Date(query.fechaInicio);
      if (query.fechaFin) where.creadoEn.lte = new Date(query.fechaFin);
    }

    const [total, ventas] = await Promise.all([
      this.prisma.venta.count({ where }),
      this.prisma.venta.findMany({
        where,
        skip,
        take: limite,
        orderBy: { creadoEn: 'desc' },
        include: {
          detalles: true,
          pagos: true,
          cajero: { select: { id: true, nombre: true } },
          caja: { select: { id: true, nombre: true, codigo: true } },
        },
      }),
    ]);

    return {
      datos: ventas,
      meta: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  /**
   * Obtener detalle completo de una venta por ID o Folio
   */
  async findOneSale(empresaId: string, idOrFolio: string) {
    const venta = await this.prisma.venta.findFirst({
      where: {
        empresaId,
        OR: [{ id: idOrFolio }, { folio: idOrFolio }],
      },
      include: {
        detalles: {
          include: {
            producto: true,
          },
        },
        pagos: true,
        devoluciones: {
          include: {
            productos: true,
          },
        },
        cajero: { select: { id: true, nombre: true } },
        caja: true,
        sucursal: true,
      },
    });

    if (!venta) {
      throw new NotFoundException('La venta especificada no fue encontrada');
    }

    return venta;
  }
}
