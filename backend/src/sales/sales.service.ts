import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { MetodoPago, Prisma, TipoMovimientoInventario } from '@prisma/client';
import { consumirLotes } from '../inventory/lotes.helper';
import {
  redondearSegunUnidad,
  validarCantidadSegunUnidad,
} from '../common/validators/unidad.util';
import {
  construirRespuestaPaginada,
  normalizarPaginacion,
} from '../common/helpers/pagination.helper';
import {
  calcularPuntos,
  descuentoDeNivel,
  pesosEquivalentesDePuntos,
  resolverNivel,
} from '../customers/loyalty.util';
import { AuditService } from '../audit/audit.service';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly couponsService: CouponsService,
  ) {}

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

    // Validar cliente si viene especificado (para lealtad o venta a crédito)
    let cliente: {
      id: string;
      estaActivo: boolean;
      puntosActuales: number;
      puntosHistoricos: number;
      nivelLealtadId: string | null;
      cuentaCredito: {
        limiteCredito: number;
        saldoPendiente: number;
        diasMaximoVencimiento: number;
        estaActivo: boolean;
      } | null;
    } | null = null;

    if (dto.clienteId) {
      cliente = await this.prisma.cliente.findFirst({
        where: { id: dto.clienteId, empresaId },
        include: { cuentaCredito: true },
      });
      if (!cliente || !cliente.estaActivo) {
        throw new NotFoundException('Cliente no encontrado o inactivo');
      }
    }

    // D10: Cargar la configuración del programa de lealtad de la empresa
    const programa = await this.prisma.programaLealtad.findUnique({
      where: { empresaId },
      include: { niveles: true },
    });
    const programaActivo = programa?.habilitado ? programa : null;

    // D10: Validar canje de puntos (antes de la transacción)
    const puntosACanjear = dto.puntosACanjear ?? 0;
    if (puntosACanjear > 0) {
      if (!programaActivo || !programaActivo.permitirCanje) {
        throw new UnprocessableEntityException(
          'El canje de puntos no está habilitado',
        );
      }
      if (!cliente) {
        throw new BadRequestException(
          'El canje de puntos requiere un cliente registrado',
        );
      }
      if (puntosACanjear < programaActivo.canjeMinimoPuntos) {
        throw new UnprocessableEntityException(
          `El canje mínimo es de ${programaActivo.canjeMinimoPuntos} puntos`,
        );
      }
      if (puntosACanjear > cliente.puntosActuales) {
        throw new UnprocessableEntityException(
          `El cliente solo tiene ${cliente.puntosActuales} puntos disponibles`,
        );
      }
    }

    // Validar pagos a crédito: requieren cliente con cuenta activa y saldo disponible
    const pagosCredito = dto.pagos.filter((p) => p.metodo === MetodoPago.credito);
    if (pagosCredito.length > 0) {
      if (!cliente) {
        throw new BadRequestException(
          'La venta a crédito requiere un cliente registrado',
        );
      }
      if (pagosCredito.length > 1) {
        throw new BadRequestException(
          'Solo se permite un pago a crédito por venta',
        );
      }
      if (
        !cliente.cuentaCredito ||
        !cliente.cuentaCredito.estaActivo
      ) {
        throw new UnprocessableEntityException(
          'El cliente no tiene una cuenta de crédito activa',
        );
      }
    }

    const venta = await this.prisma.$transaction(async (tx) => {
      // 2. Incrementar la secuencia de folio de la caja atómicamente
      const cajaActualizada = await tx.caja.update({
        where: { id: cajaId },
        data: { secuenciaFolio: { increment: 1 } },
      });

      const codigoCaja = `CJ${cajaActualizada.id.slice(0, 4).toUpperCase()}`;
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
      const lotesPorProducto = new Map<
        string,
        { loteId: string; cantidad: number; costoUnitario: number }[]
      >();
      const detallesList = dto.detalles;

      // Fetch de todos los productos en una sola query (evita N+1)
      const productosIds = [...new Set(detallesList.map((i) => i.productoId))];
      const productosEncontrados = await tx.producto.findMany({
        where: { id: { in: productosIds }, empresaId },
      });
      const productosMap = new Map(
        productosEncontrados.map((p) => [p.id, p]),
      );

      // Pre-fetch de inventarios de la sucursal para los productos (evita N+1)
      const inventariosExistentes = await tx.inventarioSucursal.findMany({
        where: { sucursalId, productoId: { in: productosIds } },
      });
      const inventariosMap = new Map(
        inventariosExistentes.map((i) => [i.productoId, i]),
      );

      // Acumulador de movimientos de inventario para insertarlos en lote
      const movimientosData: Prisma.MovimientoInventarioCreateManyInput[] = [];

      for (const item of detallesList) {
        const producto = productosMap.get(item.productoId);

        if (!producto) {
          throw new NotFoundException(
            `El producto con ID ${item.productoId} no fue encontrado`,
          );
        }

        // Validar y redondear cantidad según unidad de medida
        validarCantidadSegunUnidad(
          item.cantidad,
          item.unidadMedida || producto.unidadMedida,
          'venta',
        );
        item.cantidad = redondearSegunUnidad(
          item.cantidad,
          item.unidadMedida || producto.unidadMedida,
        );

        const subtotalItem = item.cantidad * item.precioUnitario;
        const descuentoItem = item.descuento || 0;
        const totalItem = subtotalItem - descuentoItem;

        subtotalVenta += subtotalItem;
        descuentoVenta += descuentoItem;

        // Descontar inventario (Permisivo: se permite stock negativo con registro auditado)
        let costoHistorico = producto.precioCompra || 0;

        if (producto.manejaInventario) {
          let inventario = inventariosMap.get(item.productoId);

          if (!inventario) {
            inventario = await tx.inventarioSucursal.create({
              data: {
                sucursalId,
                productoId: item.productoId,
                stockActual: 0,
              },
            });
            inventariosMap.set(item.productoId, inventario);
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

          // Consumo por lote (FEFO/FIFO según producto) — siempre con manejaInventario
          let lotesConsumidos: Awaited<ReturnType<typeof consumirLotes>> = [];

          lotesConsumidos = await consumirLotes(
            tx,
            item.productoId,
            sucursalId,
            item.cantidad,
            item.unidadMedida || producto.unidadMedida,
          );

          if (lotesConsumidos.length > 0) {
            lotesPorProducto.set(
              item.productoId,
              lotesConsumidos.map((l) => ({
                loteId: l.loteId,
                cantidad: l.cantidad,
                costoUnitario: l.costoUnitario,
              })),
            );

            // Costo histórico = promedio ponderado por los lotes consumidos
            costoHistorico =
              lotesConsumidos.reduce(
                (acc, l) => acc + l.costoUnitario * l.cantidad,
                0,
              ) / item.cantidad;

            // Un movimiento por lote para trazabilidad
            for (const lote of lotesConsumidos) {
              movimientosData.push({
                productoId: item.productoId,
                sucursalId,
                loteId: lote.loteId,
                tipo: TipoMovimientoInventario.venta,
                cantidad: lote.cantidad,
                stockAnterior,
                stockNuevo,
                referencia: folio,
                motivo: `Venta POS - Folio ${folio} - Lote ${lote.codigoLote}`,
                usuarioId: cajeroId,
              });
            }
          }

          if (lotesConsumidos.length === 0) {
            movimientosData.push({
              productoId: item.productoId,
              sucursalId,
              tipo: TipoMovimientoInventario.venta,
              cantidad: item.cantidad,
              stockAnterior,
              stockNuevo,
              referencia: folio,
              motivo: `Venta POS - Folio ${folio}`,
              usuarioId: cajeroId,
            });
          }
        }

        detallesData.push({
          productoId: item.productoId,
          nombreProducto: producto.nombre,
          unidadMedida: item.unidadMedida || producto.unidadMedida,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          costoHistorico,
          subtotal: subtotalItem,
          descuento: descuentoItem,
          impuestos: 0,
          total: totalItem,
        });
      }

      // Insertar todos los movimientos de inventario en una sola query
      if (movimientosData.length > 0) {
        await tx.movimientoInventario.createMany({ data: movimientosData });
      }

      // #4: redondear acumulados a centavos para evitar artefactos de punto flotante
      subtotalVenta = Math.round(subtotalVenta * 100) / 100;
      descuentoVenta = Math.round(descuentoVenta * 100) / 100;

      // D12: Cupón de descuento — validación y cálculo atómicos dentro de la transacción
      // (existencias = límite de usos; se cuentan con la transacción para evitar
      // condiciones de carrera entre "primeras N personas").
      let cuponDescuento = 0;
      let cuponRegistrado: {
        id: string;
        codigo: string;
        nombre: string;
      } | null = null;

      if (dto.codigoCupon) {
        const codigoCupon = dto.codigoCupon.trim().toUpperCase();
        const cupon = await tx.cupon.findFirst({
          where: { empresaId, codigo: codigoCupon },
          include: { _count: { select: { redenciones: true } } },
        });
        if (!cupon) {
          throw new BadRequestException('Cupón no encontrado');
        }
        if (!cupon.activo) {
          throw new BadRequestException('El cupón está desactivado');
        }
        const ahora = new Date();
        if (ahora < cupon.fechaInicio) {
          throw new BadRequestException('El cupón aún no está vigente');
        }
        if (cupon.fechaFin && ahora > cupon.fechaFin) {
          throw new BadRequestException('El cupón ha caducado');
        }
        if (cupon.soloClientesRegistrados && !cliente) {
          throw new BadRequestException(
            'Este cupón solo aplica para clientes registrados',
          );
        }

        // Monto mínimo de compra (base = subtotal sin descuentos)
        const baseCupon = subtotalVenta - descuentoVenta;
        if (
          cupon.montoMinimoCompra &&
          baseCupon < cupon.montoMinimoCompra
        ) {
          throw new BadRequestException(
            `Este cupón requiere una compra mínima de $${cupon.montoMinimoCompra.toFixed(2)}`,
          );
        }

        // Límite total de usos (atómico dentro de la transacción)
        if (
          cupon.limiteUsosTotal !== null &&
          cupon._count.redenciones >= cupon.limiteUsosTotal
        ) {
          throw new BadRequestException(
            'Este cupón ya alcanzó su límite de usos disponibles',
          );
        }

        // Límite por cliente (atómico dentro de la transacción)
        if (cupon.limiteUsosPorCliente && cliente) {
          const usosCliente = await tx.cuponRedencion.count({
            where: { cuponId: cupon.id, clienteId: cliente.id },
          });
          if (usosCliente >= cupon.limiteUsosPorCliente) {
            throw new BadRequestException(
              'Este cliente ya alcanzó el límite de usos de este cupón',
            );
          }
        }

        // Calcular el descuento del cupón (no puede exceder el total de la venta)
        cuponDescuento = await this.couponsService.calcularDescuento(
          cupon,
          baseCupon,
        );
        cuponRegistrado = {
          id: cupon.id,
          codigo: cupon.codigo,
          nombre: cupon.nombre,
        };
      }

      // D10: Descuento por nivel de lealtad según la configuración del programa
      let descuentoLealtad = 0;
      if (programaActivo && cliente) {
        const nivelActual = cliente.nivelLealtadId
          ? programaActivo.niveles.find((n) => n.id === cliente.nivelLealtadId) ??
            resolverNivel(cliente.puntosHistoricos, programaActivo.niveles)
          : resolverNivel(cliente.puntosHistoricos, programaActivo.niveles);
        const pct = descuentoDeNivel(nivelActual);
        const baseDescuento = subtotalVenta - descuentoVenta;
        if (pct > 0 && baseDescuento > 0) {
          descuentoLealtad =
            Math.round(baseDescuento * pct) / 100;
        }
      }

      // D10: Canje de puntos → equivale a un descuento adicional sobre la venta
      let montoCanje = 0;
      if (puntosACanjear > 0 && programaActivo) {
        montoCanje = pesosEquivalentesDePuntos(puntosACanjear, programaActivo);
        const restante =
          subtotalVenta - descuentoVenta - descuentoLealtad - cuponDescuento;
        if (montoCanje > restante) {
          throw new BadRequestException(
            `El canje ($${montoCanje.toFixed(2)}) excede el total de la venta ($${restante.toFixed(2)})`,
          );
        }
      }

      const totalVenta =
        Math.round(
          (subtotalVenta -
            descuentoVenta -
            descuentoLealtad -
            cuponDescuento -
            montoCanje +
            impuestosVenta) *
            100,
        ) / 100;

      // 4. Procesar pagos y actualizar acumulación en SesionCaja
      // Los pagos a crédito no se registran como PagoVenta: generan deuda (VentaCredito)
      let acumuladoEfectivo = 0;
      let acumuladoTarjeta = 0;
      let acumuladoOtros = 0;

      const pagosData = dto.pagos
        .filter((pago) => pago.metodo !== MetodoPago.credito)
        .map((pago) => {
          const metodoEnum = pago.metodo;
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

      const pagoCredito =
        pagosCredito.length > 0 ? pagosCredito[0] : null;
      if (pagoCredito) {
        acumuladoOtros += pagoCredito.montoPagado;
      }

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
          clienteId: cliente?.id ?? null,
          folio,
          secuenciaFolio: cajaActualizada.secuenciaFolio,
          subtotal: subtotalVenta,
          descuento: descuentoVenta + descuentoLealtad + cuponDescuento + montoCanje,
          descuentoNivel: descuentoLealtad,
          descuentoCanje: montoCanje,
          descuentoCupon: cuponDescuento,
          impuestos: impuestosVenta,
          total: totalVenta,
          estado: 'completada',
          detalles: {
            create: detallesData,
          },
          pagos: {
            create: pagosData,
          },
        },
        include: {
          detalles: {
            include: {
              lotes: {
                include: { lote: { select: { id: true, codigoLote: true } } },
              },
            },
          },
          pagos: true,
          cajero: {
            select: { id: true, nombre: true },
          },
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellidoPaterno: true,
              cuentaCredito: {
                select: { id: true, limiteCredito: true, saldoPendiente: true, estaActivo: true },
              },
            },
          },
          caja: true,
        },
      });

      // 5b. Trazabilidad por lote: vincular cada línea con los lotes consumidos
      if (lotesPorProducto.size > 0) {
        const detallePorProducto = new Map(
          venta.detalles.map((d) => [d.productoId, d.id]),
        );

        const trazabilidadData: Prisma.DetalleVentaLoteCreateManyInput[] = [];
        for (const [productoId, lotes] of lotesPorProducto) {
          const detalleVentaId = detallePorProducto.get(productoId);
          if (!detalleVentaId) continue;

          for (const l of lotes) {
            trazabilidadData.push({
              detalleVentaId,
              loteId: l.loteId,
              cantidad: l.cantidad,
              costoUnitario: l.costoUnitario,
            });
          }
        }

        if (trazabilidadData.length > 0) {
          await tx.detalleVentaLote.createMany({ data: trazabilidadData });
        }
      }

      // 5c. Cupón redimido: registrar la redención vinculada a esta venta
      if (cuponRegistrado && cuponDescuento > 0) {
        await tx.cuponRedencion.create({
          data: {
            cuponId: cuponRegistrado.id,
            ventaId: venta.id,
            clienteId: cliente?.id ?? null,
            montoDescuento: cuponDescuento,
          },
        });
      }

      // 5d. Venta a crédito: crear la deuda (VentaCredito) e incrementar saldo
      if (pagoCredito && cliente?.cuentaCredito) {
        const cuenta = cliente.cuentaCredito;
        const saldoDisponible = cuenta.limiteCredito - cuenta.saldoPendiente;

        if (pagoCredito.montoPagado > saldoDisponible + 0.001) {
          throw new UnprocessableEntityException(
            `Límite de crédito insuficiente. Disponible: $${saldoDisponible.toFixed(2)}, solicitado: $${pagoCredito.montoPagado.toFixed(2)}`,
          );
        }

        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(
          fechaVencimiento.getDate() + cuenta.diasMaximoVencimiento,
        );

        await tx.ventaCredito.create({
          data: {
            ventaId: venta.id,
            clienteId: cliente.id,
            montoTotal: pagoCredito.montoPagado,
            saldoPendiente: pagoCredito.montoPagado,
            estado: 'pendiente',
            fechaVencimiento,
          },
        });

        await tx.cuentaCreditoCliente.update({
          where: { clienteId: cliente.id },
          data: { saldoPendiente: { increment: pagoCredito.montoPagado } },
        });
      }

      // 5e. D10/D11: Programa de lealtad — canje, acumulación y ledger de movimientos
      if (cliente && programaActivo) {
        const netoSinDescuentoLealtad = subtotalVenta - descuentoVenta;
        const puntosGanados = calcularPuntos(
          netoSinDescuentoLealtad,
          totalVenta,
          programaActivo,
        );
        const nuevosHistoricos = cliente.puntosHistoricos + puntosGanados;
        const nuevoNivel = resolverNivel(
          nuevosHistoricos,
          programaActivo.niveles,
        );

        // D11: registrar el lote de puntos ganados con su fecha de vencimiento
        if (puntosGanados > 0) {
          const meses = programaActivo.mesesExpiracionPuntos ?? 0;
          let expiraEn: Date | null = null;
          if (meses > 0) {
            expiraEn = new Date();
            expiraEn.setMonth(expiraEn.getMonth() + meses);
          }
          await tx.movimientoPuntos.create({
            data: {
              clienteId: cliente.id,
              ventaId: venta.id,
              tipo: 'GANADO',
              puntos: puntosGanados,
              expiraEn,
            },
          });
        }

        // D11: canje — consumir lotes FIFO/FEFO (los más viejos o próximos a
        // vencer primero) y registrar. Se excluye el lote ganado en ESTA misma
        // venta: dentro de la transacción todos comparten now() idéntico y el
        // orden sería indeterminado; además los puntos recién ganados no deben
        // poder gastarse en la misma compra.
        if (puntosACanjear > 0) {
          const lotes = await tx.movimientoPuntos.findMany({
            where: {
              clienteId: cliente.id,
              tipo: 'GANADO',
              ventaId: { not: venta.id },
            },
            orderBy: [
              { expiraEn: { sort: 'asc', nulls: 'last' } },
              { creadoEn: 'asc' },
              { id: 'asc' },
            ],
          });
          let porConsumir = puntosACanjear;
          for (const lote of lotes) {
            if (porConsumir <= 0) break;
            const disponible = lote.puntos - lote.puntosConsumidos;
            if (disponible <= 0) continue;
            const consumo = Math.min(disponible, porConsumir);
            await tx.movimientoPuntos.update({
              where: { id: lote.id },
              data: { puntosConsumidos: { increment: consumo } },
            });
            porConsumir -= consumo;
          }
          await tx.movimientoPuntos.create({
            data: {
              clienteId: cliente.id,
              ventaId: venta.id,
              tipo: 'CANJEADO',
              puntos: -puntosACanjear,
            },
          });
        }

        await tx.cliente.update({
          where: { id: cliente.id },
          data: {
            puntosActuales: { increment: puntosGanados - puntosACanjear },
            puntosHistoricos: { increment: puntosGanados },
            nivelLealtadId: nuevoNivel?.id ?? null,
          },
        });
      }

      return venta;
    });

    // Auditoría: registrar la venta completada (posterior a la transacción)
    await this.auditService.registrarEvento({
      empresaId,
      sucursalId: sucursalId ?? null,
      usuarioId: cajeroId,
      accion: 'VENTA_COMPLETADA',
      entidadTipo: 'venta',
      entidadId: venta.id,
      detalles: {
        folio: venta.folio,
        total: venta.total,
        subtotal: venta.subtotal,
        impuestos: venta.impuestos,
        descuento: venta.descuento,
        metodoPago: dto.pagos?.length
          ? dto.pagos.map((p) => p.metodo).join(', ')
          : 'publico',
        esDemostracion: venta.esDemostracion,
      },
      severidad: 'info',
    });

    return venta;
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
      page?: number;
      limit?: number;
    },
  ) {
    const { page, limit, skip } = normalizarPaginacion(query.page, query.limit);

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
        take: limit,
        orderBy: { creadoEn: 'desc' },
        include: {
          detalles: true,
          pagos: true,
          cajero: { select: { id: true, nombre: true } },
          caja: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    return construirRespuestaPaginada(ventas, total, page, limit);
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
            lotes: {
              include: { lote: { select: { id: true, codigoLote: true } } },
            },
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
        cliente: {
          select: { id: true, nombre: true, apellidoPaterno: true },
        },
        movimientosPuntos: {
          select: { tipo: true, puntos: true, expiraEn: true },
        },
        ventaCredito: {
          select: {
            montoTotal: true,
            montoPagado: true,
            saldoPendiente: true,
            estado: true,
            fechaVencimiento: true,
          },
        },
        cuponRedencion: {
          include: {
            cupon: {
              select: { id: true, codigo: true, nombre: true, tipoDescuento: true },
            },
          },
        },
      },
    });

    if (!venta) {
      throw new NotFoundException('La venta especificada no fue encontrada');
    }

    return venta;
  }
}
