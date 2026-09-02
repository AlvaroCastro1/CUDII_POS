import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CouponsService } from '../coupons/coupons.service';
import { expandirCombos, LineaVenta } from '../sales/pricing.helper';
import {
  construirRespuestaPaginada,
  normalizarPaginacion,
} from '../common/helpers/pagination.helper';
import {
  resolverNivel,
  descuentoDeNivel,
  pesosEquivalentesDePuntos,
} from '../customers/loyalty.util';
import { CrearPresupuestoDto } from './dto/crear-presupuesto.dto';

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * D12: Módulo de Presupuestos (cotizaciones).
 * Un presupuesto es una "venta en formato pre-cobro": snapshot congelado del
 * desglose de un carrito, sin exigir sesión de caja abierta ni tocar inventario.
 * Se puede convertir en venta después por su ID (POST /sales con presupuestoId).
 */
@Injectable()
export class PresupuestosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly couponsService: CouponsService,
  ) {}

  /**
   * Crear un presupuesto. Calcula el desglose con el mismo motor de precios
   * que la venta (cascada: ítems/combo -> descuento general -> nivel -> cupón ->
   * canje) pero SIN redimir el cupón, SIN consumir puntos ni tocar inventario.
   * Genera folio atómico por empresa (P-000001) usando Empresa.secuenciaPresupuesto.
   */
  async crear(cajeroId: string, empresaId: string, dto: CrearPresupuestoDto) {
    if (
      dto.detalles.length === 0 &&
      (!dto.combos || dto.combos.length === 0)
    ) {
      throw new BadRequestException(
        'El presupuesto debe incluir al menos un producto o un combo',
      );
    }

    // Cliente (si viene) para lealtad y venta a crédito al momento de vender.
    let cliente: {
      id: string;
      estaActivo: boolean;
      puntosActuales: number;
      puntosHistoricos: number;
      nivelLealtadId: string | null;
    } | null = null;
    if (dto.clienteId) {
      cliente = await this.prisma.cliente.findFirst({
        where: { id: dto.clienteId, empresaId },
      });
      if (!cliente || !cliente.estaActivo) {
        throw new NotFoundException('Cliente no encontrado o inactivo');
      }
    }

    // Configuración del programa de lealtad (para nivel/canje).
    const programa = await this.prisma.programaLealtad.findUnique({
      where: { empresaId },
      include: { niveles: true },
    });
    const programaActivo = programa?.habilitado ? programa : null;

    // Validar canje (sin consumirlo).
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

    const resultado = await this.prisma.$transaction(async (tx) => {
      // Folio atómico por empresa: incrementar la secuencia y leerla.
      const empresa = await tx.empresa.update({
        where: { id: empresaId },
        data: { secuenciaPresupuesto: { increment: 1 } },
      });
      const folio = `P-${String(empresa.secuenciaPresupuesto).padStart(6, '0')}`;

      // Expandir combos y cargar productos con precios autoritativos de BD.
      const detallesList: LineaVenta[] = [
        ...dto.detalles.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          unidadMedida: d.unidadMedida,
          // El precio se resuelve del catálogo (snapshot) en el loop; aquí 0.
          precioUnitario: 0,
        })),
      ];
      if (dto.combos && dto.combos.length > 0) {
        detallesList.push(...(await expandirCombos(tx, dto.combos, empresaId)));
      }

      const productosIds = [...new Set(detallesList.map((i) => i.productoId))];
      const productos = await tx.producto.findMany({
        where: { id: { in: productosIds }, empresaId },
      });
      const productosMap = new Map(productos.map((p) => [p.id, p]));

      let subtotal = 0;
      let descuentoItems = 0;
      const detallesData: Prisma.PresupuestoDetalleCreateWithoutPresupuestoInput[] =
        [];

      for (const item of detallesList) {
        const producto = productosMap.get(item.productoId);
        if (!producto) {
          throw new NotFoundException(
            `El producto con ID ${item.productoId} no fue encontrado`,
          );
        }

        // Precio CONGELADO al crear = precioVentaBase actual del catálogo.
        const precioUnitario =
          item.comboId && item.precioUnitario > 0
            ? item.precioUnitario
            : producto.precioVentaBase;
        const descuento = item.descuento || 0;
        const subtotalItem = redondear2(item.cantidad * precioUnitario);
        const totalItem = redondear2(subtotalItem - descuento);

        subtotal += subtotalItem;
        descuentoItems += descuento;

        detallesData.push({
          producto: { connect: { id: producto.id } },
          combo: item.comboId
            ? { connect: { id: item.comboId } }
            : undefined,
          nombreCombo: item.nombreCombo ?? null,
          nombreProducto: producto.nombre,
          unidadMedida: item.unidadMedida || producto.unidadMedida,
          cantidad: item.cantidad,
          precioUnitario,
          descuento,
          subtotal: subtotalItem,
          total: totalItem,
        });
      }

      subtotal = redondear2(subtotal);
      descuentoItems = redondear2(descuentoItems);
      const descuentoGeneral = redondear2(dto.descuentoGeneral || 0);
      const baseDescuento = redondear2(subtotal - (descuentoItems + descuentoGeneral));

      // Cupón: se valida (vigencia/activo/monto mínimo/límites) pero NO se redime.
      let cuponDescuento = 0;
      if (dto.codigoCupon) {
        const cupon = await tx.cupon.findFirst({
          where: { empresaId, codigo: dto.codigoCupon.trim().toUpperCase() },
          include: { _count: { select: { redenciones: true } } },
        });
        if (!cupon) throw new BadRequestException('Cupón no encontrado');
        if (!cupon.activo)
          throw new BadRequestException('El cupón está desactivado');
        const ahora = new Date();
        if (ahora < cupon.fechaInicio)
          throw new BadRequestException('El cupón aún no está vigente');
        if (cupon.fechaFin && ahora > cupon.fechaFin)
          throw new BadRequestException('El cupón ha caducado');
        if (cupon.soloClientesRegistrados && !cliente)
          throw new BadRequestException(
            'Este cupón solo aplica para clientes registrados',
          );
        if (cupon.montoMinimoCompra && baseDescuento < cupon.montoMinimoCompra)
          throw new BadRequestException(
            `Este cupón requiere una compra mínima de $${cupon.montoMinimoCompra.toFixed(2)}`,
          );
        if (
          cupon.limiteUsosTotal !== null &&
          cupon._count.redenciones >= cupon.limiteUsosTotal
        )
          throw new BadRequestException(
            'Este cupón ya alcanzó su límite de usos disponibles',
          );
        if (cupon.limiteUsosPorCliente && cliente) {
          const usos = await tx.cuponRedencion.count({
            where: { cuponId: cupon.id, clienteId: cliente.id },
          });
          if (usos >= cupon.limiteUsosPorCliente)
            throw new BadRequestException(
              'Este cliente ya alcanzó el límite de usos de este cupón',
            );
        }
        cuponDescuento = await this.couponsService.calcularDescuento(
          cupon,
          baseDescuento,
        );
      }

      // Descuento por nivel de lealtad (snapshot, no consume nada).
      let descuentoNivel = 0;
      if (programaActivo && cliente) {
        const nivel = cliente.nivelLealtadId
          ? programaActivo.niveles.find((n) => n.id === cliente.nivelLealtadId) ??
            resolverNivel(cliente.puntosHistoricos, programaActivo.niveles)
          : resolverNivel(cliente.puntosHistoricos, programaActivo.niveles);
        const pct = descuentoDeNivel(nivel);
        if (pct > 0 && baseDescuento > 0)
          descuentoNivel = redondear2((baseDescuento * pct) / 100);
      }

      // Canje (snapshot, no consume puntos).
      let descuentoCanje = 0;
      if (puntosACanjear > 0 && programaActivo) {
        descuentoCanje = pesosEquivalentesDePuntos(
          puntosACanjear,
          programaActivo,
        );
        const restante = redondear2(
          baseDescuento - descuentoNivel - cuponDescuento,
        );
        if (descuentoCanje > restante)
          throw new BadRequestException(
            `El canje ($${descuentoCanje.toFixed(2)}) excede el total de la cotización ($${restante.toFixed(2)})`,
          );
      }

      const total = redondear2(
        baseDescuento - descuentoNivel - cuponDescuento - descuentoCanje,
      );

      const presupuesto = await tx.presupuesto.create({
        data: {
          empresaId,
          cajeroId,
          clienteId: cliente?.id ?? null,
          folio,
          secuenciaFolio: empresa.secuenciaPresupuesto,
          estado: 'abierto',
          subtotal,
          descuento: redondear2(descuentoItems + descuentoGeneral),
          impuestos: 0,
          total,
          descuentoNivel,
          descuentoCanje,
          descuentoCupon: cuponDescuento,
          descuentoGeneral,
          codigoCupon: dto.codigoCupon?.trim().toUpperCase() ?? null,
          puntosACanjear,
          detalles: { create: detallesData },
        },
        include: {
          cliente: {
            select: { id: true, nombre: true, apellidoPaterno: true },
          },
          cajero: { select: { id: true, nombre: true } },
          detalles: true,
        },
      });

      return {
        presupuesto,
        desglose: {
          subtotal,
          descuentoItems,
          descuentoGeneral,
          descuentoNivel,
          descuentoCupon: cuponDescuento,
          descuentoCanje,
          total,
        },
      };
    });

    // Auditoría: registro de creación del presupuesto.
    await this.auditService.registrarEvento({
      empresaId,
      usuarioId: cajeroId,
      accion: 'PRESUPUESTO_CREADO',
      entidadTipo: 'presupuesto',
      entidadId: resultado.presupuesto.id,
      detalles: {
        folio: resultado.presupuesto.folio,
        estado: resultado.presupuesto.estado,
        total: resultado.presupuesto.total,
        subtotal: resultado.presupuesto.subtotal,
        numeroLineas: resultado.presupuesto.detalles.length,
        clienteId: resultado.presupuesto.clienteId ?? null,
        tieneCupon: Boolean(resultado.presupuesto.codigoCupon),
      },
      severidad: 'info',
    });

    return resultado.presupuesto;
  }

  /**
   * D12: Marca como "vencido" (de forma perezosa, al leer) los presupuestos
   * abiertos que superaron la ventana de expiración configurada
   * (Empresa.diasExpiracionPresupuesto). 0 = sin vencimiento, no hace nada.
   */
  private async marcarVencidos(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { diasExpiracionPresupuesto: true },
    });
    const dias = empresa?.diasExpiracionPresupuesto ?? 0;
    if (dias <= 0) return;
    const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    await this.prisma.presupuesto.updateMany({
      where: {
        empresaId,
        estado: 'abierto',
        creadoEn: { lte: corte },
      },
      data: { estado: 'vencido' },
    });
  }

  /**
   * D12: Barrido en segundo plano que marca como "vencido" los presupuestos
   * abiertos de TODAS las empresas que superaron su ventana de expiración.
   * Es el análogo a cómo se "actualizan solas" las caducidades: corre de forma
   * periódica (ver PresupuestosExpiracionService) sin esperar a que alguien
   * consulte el recurso.
   * @returns Resumen de empresas revisadas y presupuestos marcados.
   */
  async marcarVencidosGlobal() {
    const empresas = await this.prisma.empresa.findMany({
      where: { diasExpiracionPresupuesto: { gt: 0 } },
      select: { id: true, diasExpiracionPresupuesto: true },
    });
    const ahora = Date.now();
    let marcados = 0;
    for (const e of empresas) {
      const corte = new Date(
        ahora - e.diasExpiracionPresupuesto * 24 * 60 * 60 * 1000,
      );
      const res = await this.prisma.presupuesto.updateMany({
        where: {
          empresaId: e.id,
          estado: 'abierto',
          creadoEn: { lte: corte },
        },
        data: { estado: 'vencido' },
      });
      marcados += res.count;
    }
    return { revisadas: empresas.length, marcados };
  }

  /**
   * Listar presupuestos de la empresa con paginación y filtros
   * (estado, rango de fechas, folio/cliente).
   */
  async listar(
    empresaId: string,
    page = 1,
    limit = 20,
    opts: {
      estado?: string;
      fechaInicio?: string;
      fechaFin?: string;
      busqueda?: string;
      incluirCancelados?: string;
    } = {},
  ) {
    await this.marcarVencidos(empresaId);
    const where: Prisma.PresupuestoWhereInput = { empresaId };
    if (opts.estado) {
      where.estado = opts.estado as never;
    } else if (opts.incluirCancelados !== 'true') {
      where.estado = { not: 'cancelado' } as never;
    }
    if (opts.fechaInicio || opts.fechaFin) {
      where.creadoEn = {};
      if (opts.fechaInicio)
        where.creadoEn.gte = new Date(`${opts.fechaInicio}T00:00:00`);
      if (opts.fechaFin)
        where.creadoEn.lte = new Date(`${opts.fechaFin}T23:59:59`);
    }
    if (opts.busqueda) {
      where.OR = [
        { folio: { contains: opts.busqueda, mode: 'insensitive' as const } },
        {
          cliente: {
            OR: [
              { nombre: { contains: opts.busqueda, mode: 'insensitive' as const } },
              {
                apellidoPaterno: {
                  contains: opts.busqueda,
                  mode: 'insensitive' as const,
                },
              },
            ],
          },
        },
      ];
    }

    const { page: p, limit: l, skip } = normalizarPaginacion(page, limit);
    const [total, data] = await Promise.all([
      this.prisma.presupuesto.count({ where }),
      this.prisma.presupuesto.findMany({
        where,
        skip,
        take: l,
        orderBy: { creadoEn: 'desc' },
        include: {
          cliente: { select: { id: true, nombre: true, apellidoPaterno: true } },
          cajero: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { diasExpiracionPresupuesto: true },
    });
    const dias = empresa?.diasExpiracionPresupuesto ?? 0;
    const conVencimiento = data.map((p) => ({
      ...p,
      diasExpiracionPresupuesto: dias,
      fechaVencimiento:
        dias > 0
          ? new Date(p.creadoEn.getTime() + dias * 24 * 60 * 60 * 1000)
          : null,
    }));

    return construirRespuestaPaginada(conVencimiento, total, p, l);
  }

  /**
   * Detalle de un presupuesto, incluyendo por cada línea:
   * - precioCongelado (el que se guardó al crear)
   * - precioActual (el vigente en catálogo hoy)
   * - precioEfectivo (según la config conservarPrecioPresupuesto: lo que se carga al ticket)
   */
  async detalle(empresaId: string, id: string) {
    await this.marcarVencidos(empresaId);
    const presupuesto = await this.prisma.presupuesto.findFirst({
      where: { id, empresaId },
      include: {
        cliente: { select: { id: true, nombre: true, apellidoPaterno: true } },
        cajero: { select: { id: true, nombre: true } },
        empresa: {
          select: {
            conservarPrecioPresupuesto: true,
            diasExpiracionPresupuesto: true,
          },
        },
        detalles: {
          include: {
            producto: { select: { id: true, precioVentaBase: true } },
          },
        },
      },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    // Si el presupuesto venció, el precio se recalcula al actual del catálogo
    // aunque esté activo "conservarPrecioPresupuesto".
    const vencido = presupuesto.estado === 'vencido';
    const conservar =
      presupuesto.empresa.conservarPrecioPresupuesto && !vencido;
    const lineas = presupuesto.detalles.map((d) => {
      const precioActual = d.producto.precioVentaBase;
      const { producto: _omitir, ...resto } = d;
      return {
        ...resto,
        precioCongelado: d.precioUnitario,
        precioActual,
        precioEfectivo: conservar ? d.precioUnitario : precioActual,
      };
    });

    const diasExpiracion = presupuesto.empresa.diasExpiracionPresupuesto;
    return {
      ...presupuesto,
      empresa: undefined,
      conservarPrecioPresupuesto:
        presupuesto.empresa.conservarPrecioPresupuesto,
      diasExpiracionPresupuesto: diasExpiracion,
      fechaVencimiento:
        diasExpiracion > 0
          ? new Date(
              presupuesto.creadoEn.getTime() +
                diasExpiracion * 24 * 60 * 60 * 1000,
            )
          : null,
      precioVencido: vencido,
      detalles: lineas,
    };
  }

  /**
   * Cancelar un presupuesto (estado = cancelado). Solo posible si sigue abierto.
   */
  async cancelar(empresaId: string, id: string, usuarioId: string) {
    const presupuesto = await this.prisma.presupuesto.findFirst({
      where: { id, empresaId },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    if (presupuesto.estado === 'vendido')
      throw new BadRequestException(
        'No se puede cancelar un presupuesto ya vendido',
      );

    const actualizado = await this.prisma.presupuesto.update({
      where: { id },
      data: { estado: 'cancelado' },
    });

    await this.auditService.registrarEvento({
      empresaId,
      usuarioId,
      accion: 'PRESUPUESTO_CANCELADO',
      entidadTipo: 'presupuesto',
      entidadId: actualizado.id,
      detalles: { folio: actualizado.folio, estado: actualizado.estado },
      severidad: 'warning',
    });

    return actualizado;
  }

  /**
   * Descancelar un presupuesto (estado = abierto). Solo posible si está
   * cancelado. Si venció mientras estaba cancelado queda como vencido.
   */
  async descancelar(empresaId: string, id: string, usuarioId: string) {
    const presupuesto = await this.prisma.presupuesto.findFirst({
      where: { id, empresaId },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');
    if (presupuesto.estado !== 'cancelado')
      throw new BadRequestException(
        'Solo se puede descancelar un presupuesto cancelado',
      );

    const actualizado = await this.prisma.presupuesto.update({
      where: { id },
      data: { estado: 'abierto' },
    });

    await this.marcarVencidos(empresaId);

    await this.auditService.registrarEvento({
      empresaId,
      usuarioId,
      accion: 'PRESUPUESTO_DESCANCELADO',
      entidadTipo: 'presupuesto',
      entidadId: actualizado.id,
      detalles: { folio: actualizado.folio, estado: actualizado.estado },
      severidad: 'info',
    });

    return actualizado;
  }
}
