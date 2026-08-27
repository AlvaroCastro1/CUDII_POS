import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearDevolucionDto } from './dto/crear-devolucion.dto';
import {
  DestinoDevolucion,
  EstadoLote,
  MotivoDevolucion,
  MotivoMerma,
  TipoMovimientoInventario,
  Prisma,
} from '@prisma/client';
import {
  distribuirProporcional,
  redondearSegunUnidad,
  validarCantidadSegunUnidad,
} from '../common/validators/unidad.util';

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
        detalles: {
          include: { lotes: { include: { lote: true } } },
        },
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

    // Pre-cargar productos para saber unidadMedida de cada uno
    const productoIds = [...new Set(venta.detalles.map((d) => d.productoId))];
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, unidadMedida: true },
    });
    const unidadMap = new Map(productos.map((p) => [p.id, p.unidadMedida]));

    return this.prisma.$transaction(async (tx) => {
      // 1. Generar folio para la devolución
      const totalDevolucionesPrevias = await tx.devolucion.count({
        where: { venta: { empresaId } },
      });
      const folio = `DEV-${String(totalDevolucionesPrevias + 1).padStart(6, '0')}`;

      let totalDevuelto = 0;
      const itemsDevolucionData = [];

      // Mapa de estados de lote desde el include de la venta (evita N+1)
      const estadoLoteMap = new Map<string, EstadoLote>();
      for (const d of venta.detalles) {
        for (const dl of d.lotes || []) {
          if (dl.lote) estadoLoteMap.set(dl.loteId, dl.lote.estado);
        }
      }

      // Acumuladores para inserciones en lote (evita N+1)
      const movimientosData: Prisma.MovimientoInventarioCreateManyInput[] = [];
      const mermasData: Prisma.MermaCreateManyInput[] = [];

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

        // Validar y redondear cantidad según unidad de medida
        const unidad = unidadMap.get(item.productoId) || 'pieza';
        validarCantidadSegunUnidad(item.cantidadDevuelta, unidad, 'devolución');
        item.cantidadDevuelta = redondearSegunUnidad(item.cantidadDevuelta, unidad);

        const subtotalItem = item.cantidadDevuelta * item.precioUnitario;
        totalDevuelto += subtotalItem;

        const lotesVenta = detalleOriginal.lotes || [];
        const costoUnitario =
          lotesVenta[0]?.costoUnitario || detalleOriginal.costoHistorico || 0;

        let loteAsociadoId: string | null = lotesVenta[0]?.loteId || null;

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

          // Restaurar al lote original de la venta (proporcional al consumo)
          if (lotesVenta.length > 0) {
            const unidad = unidadMap.get(item.productoId) || 'pieza';
            const shares = lotesVenta.map((l) => l.cantidad);
            const cantidades = distribuirProporcional(
              item.cantidadDevuelta,
              shares,
              unidad,
            );

            for (let idx = 0; idx < lotesVenta.length; idx++) {
              const lote = lotesVenta[idx];
              const cantidadRestaurar = cantidades[idx];
              if (cantidadRestaurar <= 0) continue;

              const estadoLoteActual =
                estadoLoteMap.get(lote.loteId) || EstadoLote.activo;

              await tx.lote.update({
                where: { id: lote.loteId },
                data: {
                  cantidadRestante: { increment: cantidadRestaurar },
                  estado:
                    estadoLoteActual === EstadoLote.agotado
                      ? EstadoLote.activo
                      : estadoLoteActual,
                  actualizadoEn: new Date(),
                },
              });

              movimientosData.push({
                productoId: item.productoId,
                sucursalId: venta.sucursalId,
                loteId: lote.loteId,
                tipo: TipoMovimientoInventario.devolucion_venta,
                cantidad: cantidadRestaurar,
                stockAnterior,
                stockNuevo,
                referencia: folio,
                motivo: `Devolución a stock - Venta ${venta.folio} - Lote`,
                usuarioId,
              });
            }
            loteAsociadoId = lotesVenta[0].loteId;
          } else {
            movimientosData.push({
              productoId: item.productoId,
              sucursalId: venta.sucursalId,
              tipo: TipoMovimientoInventario.devolucion_venta,
              cantidad: item.cantidadDevuelta,
              stockAnterior,
              stockNuevo,
              referencia: folio,
              motivo: `Devolución a stock - Venta ${venta.folio}`,
              usuarioId,
            });
          }
        } else {
          // Destino: merma (no reintegra al stock vendible) — se registra Merma
          const motivoMerma: MotivoMerma =
            item.motivo === MotivoDevolucion.caducado
              ? MotivoMerma.caducado
              : item.motivo === MotivoDevolucion.danado
                ? MotivoMerma.danado
                : MotivoMerma.otro;

          if (lotesVenta.length > 0) {
            const unidad = unidadMap.get(item.productoId) || 'pieza';
            const shares = lotesVenta.map((l) => l.cantidad);
            const cantidades = distribuirProporcional(
              item.cantidadDevuelta,
              shares,
              unidad,
            );

            for (let idx = 0; idx < lotesVenta.length; idx++) {
              const lote = lotesVenta[idx];
              const cantidadMerma = cantidades[idx];
              if (cantidadMerma <= 0) continue;

              const loteCostoUnitario = lote.costoUnitario || costoUnitario;

              mermasData.push({
                empresaId,
                sucursalId: venta.sucursalId,
                productoId: item.productoId,
                loteId: lote.loteId,
                cantidad: cantidadMerma,
                motivo: motivoMerma,
                costoUnitario: loteCostoUnitario,
                costoTotal: loteCostoUnitario * cantidadMerma,
                notas: `Devolución ${folio} - Venta ${venta.folio} - Lote`,
                usuarioId,
              });

              movimientosData.push({
                productoId: item.productoId,
                sucursalId: venta.sucursalId,
                loteId: lote.loteId,
                tipo: TipoMovimientoInventario.merma,
                cantidad: cantidadMerma,
                stockAnterior,
                stockNuevo: stockAnterior,
                referencia: folio,
                motivo: `Devolución a merma (${item.motivo}) - Venta ${venta.folio} - Lote`,
                usuarioId,
              });
            }
          } else {
            mermasData.push({
              empresaId,
              sucursalId: venta.sucursalId,
              productoId: item.productoId,
              loteId: loteAsociadoId,
              cantidad: item.cantidadDevuelta,
              motivo: motivoMerma,
              costoUnitario,
              costoTotal: costoUnitario * item.cantidadDevuelta,
              notas: `Devolución ${folio} - Venta ${venta.folio}`,
              usuarioId,
            });

            movimientosData.push({
              productoId: item.productoId,
              sucursalId: venta.sucursalId,
              loteId: loteAsociadoId,
              tipo: TipoMovimientoInventario.merma,
              cantidad: item.cantidadDevuelta,
              stockAnterior,
              stockNuevo: stockAnterior,
              referencia: folio,
              motivo: `Devolución a merma (${item.motivo}) - Venta ${venta.folio}`,
              usuarioId,
            });
          }
        }

        itemsDevolucionData.push({
          productoId: item.productoId,
          loteId: loteAsociadoId,
          cantidadDevuelta: item.cantidadDevuelta,
          precioUnitario: item.precioUnitario,
          subtotal: subtotalItem,
          motivo: item.motivo,
          destino: item.destino,
        });
      }

      // Insertar mermas y movimientos en una sola query cada uno
      if (mermasData.length > 0) {
        await tx.merma.createMany({ data: mermasData });
      }
      if (movimientosData.length > 0) {
        await tx.movimientoInventario.createMany({ data: movimientosData });
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
          include: { producto: true, lote: { select: { codigoLote: true } } },
        },
        venta: { select: { id: true, folio: true } },
        usuario: { select: { id: true, nombre: true } },
      },
    });
  }
}
