import { Injectable } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

export interface RangoReporte {
  fechaInicio?: string;
  fechaFin?: string;
  sucursalId?: string;
}

/** Servicio de reportes: agregaciones de ventas, inventario, cortes y márgenes */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumen de ventas por día con desglose de métodos de pago.
   * CAJERO solo ve sus propias ventas del día (su turno).
   */
  async salesSummary(user: CurrentUserPayload, rango: RangoReporte) {
    const { where, fechaInicio, fechaFin } = this.construirFiltrosVenta(
      user,
      rango,
    );

    const ventas = await this.prisma.venta.findMany({
      where,
      select: {
        id: true,
        total: true,
        creadoEn: true,
        pagos: { select: { metodo: true, montoPagado: true } },
      },
    });

    const porDiaMap = new Map<string, { total: number; transacciones: number }>();
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalOtros = 0;
    let totalVentas = 0;

    for (const venta of ventas) {
      const fecha = venta.creadoEn.toISOString().slice(0, 10);
      const dia = porDiaMap.get(fecha) ?? { total: 0, transacciones: 0 };
      dia.total += venta.total;
      dia.transacciones += 1;
      porDiaMap.set(fecha, dia);

      totalVentas += venta.total;
      for (const pago of venta.pagos) {
        if (pago.metodo === 'efectivo') totalEfectivo += pago.montoPagado;
        else if (pago.metodo === 'tarjeta') totalTarjeta += pago.montoPagado;
        else totalOtros += pago.montoPagado;
      }
    }

    const numTransacciones = ventas.length;

    return {
      rango: { fechaInicio, fechaFin },
      resumen: {
        totalVentas,
        numTransacciones,
        ticketPromedio: numTransacciones > 0 ? totalVentas / numTransacciones : 0,
        totalEfectivo,
        totalTarjeta,
        totalOtros,
      },
      porDia: [...porDiaMap.entries()]
        .map(([fecha, v]) => ({ fecha, ...v }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    };
  }

  /** Top N productos más vendidos en el rango */
  async topProducts(
    user: CurrentUserPayload,
    rango: RangoReporte,
    limit = 10,
  ) {
    const { whereSql, params } = this.construirWhereSqlVenta(user, rango);

    const rows = await this.prisma.$queryRaw<
      {
        productoId: string;
        nombre: string;
        codigoBarras: string;
        cantidadVendida: number;
        ingresos: number;
      }[]
    >`
      SELECT d."productoId",
             p."nombre",
             p."codigoBarras",
             SUM(d."cantidad")::float AS "cantidadVendida",
             SUM(d."total")::float AS "ingresos"
      FROM "DetalleVenta" d
      JOIN "Venta" v ON v."id" = d."ventaId"
      JOIN "Producto" p ON p."id" = d."productoId"
      WHERE v."empresaId" = ${user.empresaId}
        AND v."estado" = 'completada'
        ${whereSql}
      GROUP BY d."productoId", p."nombre", p."codigoBarras"
      ORDER BY "cantidadVendida" DESC
      LIMIT ${Math.min(Math.max(limit, 1), 100)}
    `;

    return rows;
  }

  /** Estado de inventario con alertas de stock bajo */
  async inventory(user: CurrentUserPayload, sucursalId?: string) {
    const where: Record<string, unknown> = {
      sucursal: { empresaId: user.empresaId },
    };
    if (sucursalId) where.sucursalId = sucursalId;

    const inventarios = await this.prisma.inventarioSucursal.findMany({
      where,
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            codigoBarras: true,
            unidadMedida: true,
            estaActivo: true,
            precioCompra: true,
            precioVentaBase: true,
          },
        },
        sucursal: { select: { id: true, nombre: true } },
      },
      orderBy: [{ sucursal: { nombre: 'asc' } }, { stockActual: 'asc' }],
    });

    const items = inventarios.map((inv) => ({
      productoId: inv.producto.id,
      nombre: inv.producto.nombre,
      codigoBarras: inv.producto.codigoBarras,
      sucursal: inv.sucursal.nombre,
      stockActual: inv.stockActual,
      stockMinimo: inv.stockMinimo,
      stockMaximo: inv.stockMaximo,
      valorInventario: inv.stockActual * inv.producto.precioCompra,
      alertaStockBajo:
        inv.producto.estaActivo && inv.stockActual <= inv.stockMinimo,
    }));

    return {
      totalProductos: items.length,
      alertasStockBajo: items.filter((i) => i.alertaStockBajo).length,
      valorTotal: items.reduce((acc, i) => acc + i.valorInventario, 0),
      items,
    };
  }

  /** Histórico de cortes X/Z con diferencias */
  async cashRegister(user: CurrentUserPayload, rango: RangoReporte) {
    const fechaInicio = rango.fechaInicio ? new Date(rango.fechaInicio) : undefined;
    const fechaFin = rango.fechaFin ? new Date(rango.fechaFin) : undefined;

    const whereSesion: Record<string, unknown> = {
      caja: { sucursal: { empresaId: user.empresaId } },
    };
    if (rango.sucursalId) {
      whereSesion.caja = {
        sucursalId: rango.sucursalId,
        empresaId: user.empresaId,
      };
    }

    const cortesX = await this.prisma.corteX.findMany({
      where: {
        sesionCaja: whereSesion,
        ...(fechaInicio || fechaFin
          ? {
              fechaHora: {
                ...(fechaInicio ? { gte: fechaInicio } : {}),
                ...(fechaFin ? { lte: fechaFin } : {}),
              },
            }
          : {}),
      },
      include: {
        usuario: { select: { id: true, nombre: true } },
        sesionCaja: {
          select: { caja: { select: { nombre: true, sucursal: { select: { nombre: true } } } } },
        },
      },
      orderBy: { fechaHora: 'desc' },
      take: 200,
    });

    const cortesZ = await this.prisma.corteZ.findMany({
      where: {
        sesionCaja: whereSesion,
        ...(fechaInicio || fechaFin
          ? {
              fechaHora: {
                ...(fechaInicio ? { gte: fechaInicio } : {}),
                ...(fechaFin ? { lte: fechaFin } : {}),
              },
            }
          : {}),
      },
      include: {
        usuario: { select: { id: true, nombre: true } },
        sesionCaja: {
          select: { caja: { select: { nombre: true, sucursal: { select: { nombre: true } } } } },
        },
      },
      orderBy: { fechaHora: 'desc' },
      take: 200,
    });

    return { cortesX, cortesZ };
  }

  /** Margen de ganancia por producto o categoría */
  async margin(
    user: CurrentUserPayload,
    rango: RangoReporte,
    agruparPor: 'producto' | 'categoria' = 'producto',
  ) {
    const { whereSql, params } = this.construirWhereSqlVenta(user, rango);
    void params;

    if (agruparPor === 'categoria') {
      const rows = await this.prisma.$queryRaw<
        {
          categoria: string;
          cantidadVendida: number;
          ingresos: number;
          costo: number;
          margen: number;
        }[]
      >`
        SELECT COALESCE(c."nombre", 'Sin categoría') AS "categoria",
               SUM(d."cantidad")::float AS "cantidadVendida",
               SUM(d."total")::float AS "ingresos",
               SUM(d."costoHistorico" * d."cantidad")::float AS "costo",
               (SUM(d."total") - SUM(d."costoHistorico" * d."cantidad"))::float AS "margen"
        FROM "DetalleVenta" d
        JOIN "Venta" v ON v."id" = d."ventaId"
        JOIN "Producto" p ON p."id" = d."productoId"
        LEFT JOIN "_CategoriaToProducto" cp ON cp."B" = p."id"
        LEFT JOIN "Categoria" c ON c."id" = cp."A"
        WHERE v."empresaId" = ${user.empresaId}
          AND v."estado" = 'completada'
          ${whereSql}
        GROUP BY c."nombre"
        ORDER BY "margen" DESC
      `;
      return rows.map((r) => ({
        ...r,
        margenPct: r.ingresos > 0 ? (r.margen / r.ingresos) * 100 : null,
      }));
    }

    const rows = await this.prisma.$queryRaw<
      {
        productoId: string;
        nombre: string;
        cantidadVendida: number;
        ingresos: number;
        costo: number;
        margen: number;
      }[]
    >`
      SELECT d."productoId",
             p."nombre",
             SUM(d."cantidad")::float AS "cantidadVendida",
             SUM(d."total")::float AS "ingresos",
             SUM(d."costoHistorico" * d."cantidad")::float AS "costo",
             (SUM(d."total") - SUM(d."costoHistorico" * d."cantidad"))::float AS "margen"
      FROM "DetalleVenta" d
      JOIN "Venta" v ON v."id" = d."ventaId"
      JOIN "Producto" p ON p."id" = d."productoId"
      WHERE v."empresaId" = ${user.empresaId}
        AND v."estado" = 'completada'
        ${whereSql}
      GROUP BY d."productoId", p."nombre"
      ORDER BY "margen" DESC
    `;

    return rows.map((r) => ({
      ...r,
      margenPct: r.ingresos > 0 ? (r.margen / r.ingresos) * 100 : null,
    }));
  }

  /**
   * Filtros Prisma para ventas según rol:
   * CAJERO → solo sus ventas del día actual; resto → empresa completa.
   */
  private construirFiltrosVenta(user: CurrentUserPayload, rango: RangoReporte) {
    const fechaInicio = rango.fechaInicio
      ? new Date(rango.fechaInicio)
      : undefined;
    const fechaFin = rango.fechaFin ? new Date(rango.fechaFin) : undefined;

    const where: Record<string, unknown> = {
      empresaId: user.empresaId,
      estado: 'completada',
    };

    if (user.rol === Rol.CAJERO) {
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);
      where.cajeroId = user.id;
      where.creadoEn = { gte: inicioDia };
    } else {
      if (rango.sucursalId) where.sucursalId = rango.sucursalId;
      if (fechaInicio || fechaFin) {
        where.creadoEn = {
          ...(fechaInicio ? { gte: fechaInicio } : {}),
          ...(fechaFin ? { lte: fechaFin } : {}),
        };
      }
    }

    return { where, fechaInicio, fechaFin };
  }

  /** Fragmento SQL adicional (fechas/sucursal) para los reportes con $queryRaw */
  private construirWhereSqlVenta(user: CurrentUserPayload, rango: RangoReporte) {
    // CAJERO: restringido a su turno (día actual); otros roles: fechas y sucursal.
    if (user.rol === Rol.CAJERO) {
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);
      return {
        whereSql: Prisma.sql` AND v."cajeroId" = ${user.id} AND v."creadoEn" >= ${inicioDia} `,
        params: [],
      };
    }

    const condiciones: Prisma.Sql[] = [];
    if (rango.fechaInicio) {
      condiciones.push(
        Prisma.sql` AND v."creadoEn" >= ${new Date(rango.fechaInicio)} `,
      );
    }
    if (rango.fechaFin) {
      condiciones.push(
        Prisma.sql` AND v."creadoEn" <= ${new Date(rango.fechaFin)} `,
      );
    }
    if (rango.sucursalId) {
      condiciones.push(Prisma.sql` AND v."sucursalId" = ${rango.sucursalId} `);
    }
    if (condiciones.length === 0) {
      return { whereSql: Prisma.empty, params: [] };
    }
    return { whereSql: Prisma.join(condiciones, ' '), params: [] };
  }
}
