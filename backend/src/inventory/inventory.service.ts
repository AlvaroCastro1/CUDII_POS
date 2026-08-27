import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  EstadoLote,
  MotivoMerma,
  Prisma,
  TipoMovimientoInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CrearRecepcionDto } from './dto/crear-recepcion.dto';
import { consumirLotes, generarCodigoLote } from './lotes.helper';
import {
  redondearSegunUnidad,
  validarCantidadSegunUnidad,
} from '../common/validators/unidad.util';
import { construirRespuestaPaginada } from '../common/helpers/pagination.helper';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getStock(
    sucursalId: string,
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    incluirInactivos = false,
  ) {
    let whereClause: Prisma.InventarioSucursalWhereInput = { sucursalId };

    if (sucursalId === 'all') {
      const sucursales = await this.prisma.sucursal.findMany({
        where: { empresaId },
      });
      if (sucursales.length === 0)
        return {
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      whereClause = { sucursalId: { in: sucursales.map((s) => s.id) } };
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
          { codigoInterno: { contains: search, mode: 'insensitive' as const } },
        ],
      };
      if (!incluirInactivos) {
        whereClause.producto.estaActivo = true;
      }
    } else {
      whereClause.producto = incluirInactivos ? {} : { estaActivo: true };
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
   * Registrar una recepción de mercancía (GRN). Cada línea crea un Lote,
   * suma al inventario agregado de la sucursal y registra un movimiento.
   */
  async createRecepcion(
    dto: CrearRecepcionDto,
    empresaId: string,
    usuarioId: string,
  ) {
    const sucursal = await this.prisma.sucursal.findFirst({
      where: { id: dto.sucursalId, empresaId },
    });
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const item of dto.detalles) {
      if (item.fechaCaducidad) {
        const caducidad = new Date(item.fechaCaducidad);
        if (caducidad < hoy) {
          throw new BadRequestException(
            `La fecha de caducidad del producto ${item.productoId} ya está vencida`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const totalRecepciones = await tx.recepcionMercancia.count({
        where: { empresaId },
      });
      const folio = `REC-${String(totalRecepciones + 1).padStart(6, '0')}`;

      // Fetch de todos los productos en una sola query (evita N+1)
      const productoIds = [...new Set(dto.detalles.map((i) => i.productoId))];
      const productosEncontrados = await tx.producto.findMany({
        where: { id: { in: productoIds }, empresaId },
      });
      const productosMap = new Map(
        productosEncontrados.map((p) => [p.id, p]),
      );

      for (const item of dto.detalles) {
        const producto = productosMap.get(item.productoId);
        if (!producto) {
          throw new NotFoundException(
            `El producto con ID ${item.productoId} no fue encontrado`,
          );
        }

        // Validar y redondear cantidad según unidad de medida
        validarCantidadSegunUnidad(item.cantidad, producto.unidadMedida, 'recepción');
        item.cantidad = redondearSegunUnidad(item.cantidad, producto.unidadMedida);

        const codigoLote = item.codigoLote?.trim() || generarCodigoLote(producto.codigoBarras);

        // 1. Crear el lote (se captura el id para el movimiento, sin re-consultar)
        const loteCreado = await tx.lote.create({
          data: {
            empresaId,
            productoId: item.productoId,
            sucursalId: dto.sucursalId,
            codigoLote,
            fechaRecepcion: new Date(),
            fechaFabricacion: item.fechaFabricacion
              ? new Date(item.fechaFabricacion)
              : null,
            fechaCaducidad: item.fechaCaducidad
              ? new Date(item.fechaCaducidad)
              : null,
            cantidadInicial: item.cantidad,
            cantidadRestante: item.cantidad,
            costoUnitario: item.costoUnitario,
            proveedor: dto.proveedor || null,
            estado: EstadoLote.activo,
            creadoPorId: usuarioId,
          },
        });

        // 2. Sumar al inventario agregado
        let inventario = await tx.inventarioSucursal.findUnique({
          where: {
            sucursalId_productoId: {
              sucursalId: dto.sucursalId,
              productoId: item.productoId,
            },
          },
        });

        const stockAnterior = inventario ? inventario.stockActual : 0;
        const stockNuevo = stockAnterior + item.cantidad;

        if (inventario) {
          inventario = await tx.inventarioSucursal.update({
            where: {
              sucursalId_productoId: {
                sucursalId: dto.sucursalId,
                productoId: item.productoId,
              },
            },
            data: {
              stockActual: stockNuevo,
              ultimoMovimiento: new Date(),
            },
          });
        } else {
          inventario = await tx.inventarioSucursal.create({
            data: {
              productoId: item.productoId,
              sucursalId: dto.sucursalId,
              stockActual: stockNuevo,
            },
          });
        }

        // 3. Movimiento de compra vinculado al lote recién creado
        await tx.movimientoInventario.create({
          data: {
            productoId: item.productoId,
            sucursalId: dto.sucursalId,
            loteId: loteCreado.id,
            tipo: TipoMovimientoInventario.compra,
            cantidad: item.cantidad,
            stockAnterior,
            stockNuevo,
            referencia: folio,
            motivo: `Recepción de mercancía - Folio ${folio}`,
            usuarioId,
          },
        });
      }

      // 4. Cabecera de recepción
      const recepcion = await tx.recepcionMercancia.create({
        data: {
          empresaId,
          sucursalId: dto.sucursalId,
          folio,
          proveedor: dto.proveedor || null,
          notas: dto.notas || null,
          usuarioId,
          detalles: {
            create: dto.detalles.map((item) => ({
              productoId: item.productoId,
              cantidad: item.cantidad,
              costoUnitario: item.costoUnitario,
              codigoLote: item.codigoLote || null,
              fechaFabricacion: item.fechaFabricacion
                ? new Date(item.fechaFabricacion)
                : null,
              fechaCaducidad: item.fechaCaducidad
                ? new Date(item.fechaCaducidad)
                : null,
            })),
          },
        },
        include: {
          detalles: { include: { producto: true } },
          sucursal: true,
          usuario: { select: { id: true, nombre: true } },
        },
      });

      return recepcion;
    });
  }

  async findAllRecepciones(empresaId: string, sucursalId?: string) {
    return this.prisma.recepcionMercancia.findMany({
      where: {
        empresaId,
        ...(sucursalId ? { sucursalId } : {}),
      },
      orderBy: { fechaHora: 'desc' },
      include: {
        detalles: {
          include: {
            producto: { select: { id: true, nombre: true, codigoBarras: true } },
          },
        },
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
      },
    });
  }

  /**
   * Listar lotes con filtros (sucursal, producto, estado, por vencer, búsqueda).
   */
  async findLotes(
    empresaId: string,
    query: {
      sucursalId?: string;
      productoId?: string;
      estado?: EstadoLote;
      porVencer?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const ahora = new Date();

    const where: Prisma.LoteWhereInput = { empresaId };

    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.productoId) where.productoId = query.productoId;
    if (query.estado) where.estado = query.estado;

    if (query.porVencer) {
      where.estado = EstadoLote.activo;
      where.cantidadRestante = { gt: 0 };
      where.fechaCaducidad = {
        gte: ahora,
        lte: new Date(ahora.getTime() + 30 * 24 * 3600 * 1000),
      };
    }

    if (query.search) {
      where.producto = {
        OR: [
          { nombre: { contains: query.search, mode: 'insensitive' as const } },
          { codigoBarras: { contains: query.search, mode: 'insensitive' as const } },
        ],
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.lote.count({ where }),
      this.prisma.lote.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { fechaCaducidad: { sort: 'asc', nulls: 'last' } },
          { fechaRecepcion: 'desc' },
        ],
        include: {
          producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true, esGranel: true } },
          sucursal: { select: { id: true, nombre: true } },
        },
      }),
    ]);

      return construirRespuestaPaginada(data, total, page, limit);
    }

  /**
   * Detalle de un lote con su historial de movimientos (trazabilidad).
   */
  async findLoteById(empresaId: string, id: string) {
    const lote = await this.prisma.lote.findFirst({
      where: { id, empresaId },
      include: {
        producto: true,
        sucursal: true,
        creadoPor: { select: { id: true, nombre: true } },
        movimientos: {
          orderBy: { fechaHora: 'desc' },
          include: { usuario: { select: { id: true, nombre: true } } },
        },
        mermas: {
          orderBy: { fechaHora: 'desc' },
          include: { usuario: { select: { id: true, nombre: true } } },
        },
      },
    });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    return lote;
  }

  /**
   * #9: actualizar la fecha de caducidad de un lote existente.
   * Permite corregir capturas erróneas o asignar vencimiento a lotes sin fecha.
   */
  async actualizarFechaCaducidad(
    empresaId: string,
    id: string,
    fechaCaducidad: string | null,
  ) {
    const lote = await this.prisma.lote.findFirst({
      where: { id, empresaId },
      select: { id: true },
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    let fecha: Date | null = null;
    if (fechaCaducidad) {
      fecha = new Date(fechaCaducidad);
      if (isNaN(fecha.getTime())) {
        throw new BadRequestException('Fecha de caducidad inválida');
      }
    }

    return this.prisma.lote.update({
      where: { id },
      data: { fechaCaducidad: fecha },
    });
  }

  /**
   * Lotes por vencer y vencidos (para widget y alertas).
   */
  async findVencimientos(empresaId: string, dias?: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { diasCaducidadPreaviso: true },
    });
    const diasPreaviso = dias ?? empresa?.diasCaducidadPreaviso ?? 30;
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + diasPreaviso * 24 * 3600 * 1000);

    const [porVencer, vencidos] = await Promise.all([
      this.prisma.lote.findMany({
        where: {
          empresaId,
          estado: EstadoLote.activo,
          cantidadRestante: { gt: 0 },
          fechaCaducidad: { gte: ahora, lte: limite },
        },
        orderBy: { fechaCaducidad: 'asc' },
        include: {
          producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
          sucursal: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.lote.findMany({
        where: {
          empresaId,
          cantidadRestante: { gt: 0 },
          fechaCaducidad: { lt: ahora },
        },
        orderBy: { fechaCaducidad: 'asc' },
        include: {
          producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
          sucursal: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    const valorPorVencer = porVencer.reduce(
      (acc, l) => acc + l.cantidadRestante * l.costoUnitario,
      0,
    );
    const valorVencidos = vencidos.reduce(
      (acc, l) => acc + l.cantidadRestante * l.costoUnitario,
      0,
    );

    return {
      diasPreaviso,
      porVencer,
      vencidos,
      valorPorVencer,
      valorVencidos,
    };
  }

  /**
   * Genera notificaciones para ADMIN/GERENTE por lotes próximos a vencer
   * (con dedupe: una vez por lote por día).
   */
  async verificarLotesPorVencer(empresaId: string) {
    const { porVencer, vencidos, diasPreaviso } = await this.findVencimientos(
      empresaId,
    );

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    // Batch dedup: un solo findMany para saber qué lotes ya fueron notificados hoy
    const notificacionesHoy = await this.prisma.notificacion.findMany({
      where: {
        empresaId,
        evento: 'lote_por_vencer',
        entidadTipo: 'lote',
        fechaHora: { gte: inicioDia },
      },
      select: { entidadId: true },
    });
    const yaNotificados = new Set(notificacionesHoy.map((n) => n.entidadId));

    for (const lote of porVencer) {
      if (yaNotificados.has(lote.id)) continue;

      const diasRestantes = Math.ceil(
        (lote.fechaCaducidad!.getTime() - Date.now()) / (24 * 3600 * 1000),
      );
      await this.notifications.notificarAdminsYGerentes(empresaId, {
        titulo: 'Lote por vencer',
        mensaje: `El lote ${lote.codigoLote} de "${lote.producto.nombre}" vence en ${diasRestantes} día(s) (${lote.cantidadRestante} en stock).`,
        tipo: diasRestantes <= 7 ? 'critical' : 'warning',
        evento: 'lote_por_vencer',
        entidadTipo: 'lote',
        entidadId: lote.id,
      });
    }

    for (const lote of vencidos) {
      if (yaNotificados.has(lote.id)) continue;

      await this.notifications.notificarAdminsYGerentes(empresaId, {
        titulo: 'Lote vencido',
        mensaje: `El lote ${lote.codigoLote} de "${lote.producto.nombre}" ya caducó (${lote.cantidadRestante} en stock). Registra la merma correspondiente.`,
        tipo: 'critical',
        evento: 'lote_por_vencer',
        entidadTipo: 'lote',
        entidadId: lote.id,
      });
    }

    return { revisados: porVencer.length + vencidos.length, diasPreaviso };
  }

  async adjustStock(
    data: {
      productoId: string;
      sucursalId: string;
      cantidad: number;
      motivo: string;
      loteId?: string;
      esMerma?: boolean;
      motivoMerma?: MotivoMerma;
      costoUnitario?: number;
      fechaCaducidad?: string;
    },
    empresaId: string,
    usuarioId: string,
  ) {
    const { productoId, cantidad, motivo } = data;
    let { sucursalId } = data;

    if (!sucursalId) {
      const primeraSucursal = await this.prisma.sucursal.findFirst({
        where: { empresaId },
      });
      if (!primeraSucursal) {
        throw new NotFoundException(
          'No se encontró ninguna sucursal para esta empresa',
        );
      }
      sucursalId = primeraSucursal.id;
    }

    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, empresaId, estaActivo: true },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Validar y redondear cantidad según unidad de medida
    validarCantidadSegunUnidad(cantidad, producto.unidadMedida, 'ajuste de stock');
    data.cantidad = redondearSegunUnidad(cantidad, producto.unidadMedida);

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
          data: { stockActual: stockNuevo, ultimoMovimiento: new Date() },
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

      // Gestión de lotes según manejaInventario
      let loteCreadoId: string | null = null;
      let loteConsumidoId: string | null = null;
      let loteCosto = producto.precioCompra || 0;

      if (producto.manejaInventario) {
        if (cantidad > 0) {
          // Entrada: crear lote automático
          const codigoLote = generarCodigoLote(producto.codigoBarras);
          const costoUnitarioLote =
            data.costoUnitario ?? producto.precioCompra ?? 0;
          const fechaCaducidadLote = data.fechaCaducidad
            ? new Date(data.fechaCaducidad)
            : null;

          const nuevoLote = await tx.lote.create({
            data: {
              empresaId,
              productoId,
              sucursalId,
              codigoLote,
              fechaRecepcion: new Date(),
              fechaFabricacion: null,
              fechaCaducidad: fechaCaducidadLote,
              cantidadInicial: cantidad,
              cantidadRestante: cantidad,
              costoUnitario: costoUnitarioLote,
              proveedor: null,
              estado: EstadoLote.activo,
              creadoPorId: usuarioId,
            },
          });

          loteCreadoId = nuevoLote.id;
          loteCosto = costoUnitarioLote;
        } else if (cantidad < 0) {
          // Salida: consumir del lote
          const cantidadSalida = Math.abs(cantidad);

          if (data.loteId) {
            const lote = await tx.lote.findFirst({
              where: { id: data.loteId, productoId, sucursalId, empresaId },
            });
            if (!lote) {
              throw new NotFoundException('Lote no encontrado');
            }
            await tx.lote.update({
              where: { id: lote.id },
              data: {
                cantidadRestante: { decrement: cantidadSalida },
                estado:
                  lote.cantidadRestante - cantidadSalida <= 0
                    ? EstadoLote.agotado
                    : EstadoLote.activo,
                actualizadoEn: new Date(),
              },
            });
            loteConsumidoId = lote.id;
            loteCosto = lote.costoUnitario;
          } else {
            const consumidos = await consumirLotes(
              tx,
              productoId,
              sucursalId,
              cantidadSalida,
              producto.unidadMedida,
            );
            loteConsumidoId = consumidos[0]?.loteId || null;
            if (consumidos.length > 0) {
              loteCosto = consumidos[0].costoUnitario;
            }
          }
        }
      }

      // Registrar merma si aplica
      if (cantidad < 0 && data.esMerma) {
        const motivoMerma = data.motivoMerma || MotivoMerma.otro;
        await tx.merma.create({
          data: {
            empresaId,
            sucursalId,
            productoId,
            loteId: loteConsumidoId,
            cantidad: Math.abs(cantidad),
            motivo: motivoMerma,
            costoUnitario: loteCosto,
            costoTotal: loteCosto * Math.abs(cantidad),
            notas: motivo,
            usuarioId,
          },
        });
      }

      const tipoMovimiento =
        cantidad > 0
          ? TipoMovimientoInventario.ajuste_positivo
          : data.esMerma
            ? TipoMovimientoInventario.merma
            : TipoMovimientoInventario.ajuste_negativo;

      await tx.movimientoInventario.create({
        data: {
          productoId,
          sucursalId,
          loteId: loteCreadoId || loteConsumidoId,
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
