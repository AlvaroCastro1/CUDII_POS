import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService, RangoReporte } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

/** Controlador de reportes con exportación CSV */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** Resumen de ventas (por día) con desglose de métodos de pago */
  @Get('sales-summary')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CAJERO, Rol.CONTADOR)
  async salesSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.reportsService.salesSummary(user, {
      fechaInicio,
      fechaFin,
      sucursalId,
    });

    if (format === 'csv' && res) {
      const filas = [
        ['fecha', 'total', 'transacciones'],
        ...data.porDia.map((d) => [d.fecha, d.total, d.transacciones]),
      ];
      return enviarCsv(res, `ventas_resumen_${fechaActual()}.csv`, filas);
    }
    return data;
  }

  /** Top N productos más vendidos */
  @Get('top-products')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CONTADOR)
  async topProducts(
    @CurrentUser() user: CurrentUserPayload,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('limit') limit: string = '10',
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const rows = await this.reportsService.topProducts(
      user,
      { fechaInicio, fechaFin, sucursalId },
      parseInt(limit, 10) || 10,
    );

    if (format === 'csv' && res) {
      const filas = [
        ['productoId', 'nombre', 'codigoBarras', 'cantidadVendida', 'ingresos'],
        ...rows.map((r) => [
          r.productoId,
          r.nombre,
          r.codigoBarras,
          r.cantidadVendida,
          r.ingresos,
        ]),
      ];
      return enviarCsv(res, `top_productos_${fechaActual()}.csv`, filas);
    }
    return rows;
  }

  /** Estado de inventario con alertas */
  @Get('inventory')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.ALMACEN, Rol.CONTADOR)
  async inventory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('sucursalId') sucursalId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.reportsService.inventory(user, sucursalId);

    if (format === 'csv' && res) {
      const filas = [
        ['producto', 'codigoBarras', 'sucursal', 'stockActual', 'stockMinimo', 'valorInventario', 'alertaStockBajo'],
        ...data.items.map((i) => [
          i.nombre,
          i.codigoBarras,
          i.sucursal,
          i.stockActual,
          i.stockMinimo,
          i.valorInventario,
          i.alertaStockBajo ? 'SI' : 'NO',
        ]),
      ];
      return enviarCsv(res, `inventario_${fechaActual()}.csv`, filas);
    }
    return data;
  }

  /** Histórico de cortes X/Z con diferencias */
  @Get('cash-register')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CONTADOR)
  cashRegister(
    @CurrentUser() user: CurrentUserPayload,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.reportsService.cashRegister(user, {
      fechaInicio,
      fechaFin,
      sucursalId,
    });
  }

  /** Margen de ganancia por producto o categoría */
  @Get('margin')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE, Rol.CONTADOR)
  async margin(
    @CurrentUser() user: CurrentUserPayload,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('agruparPor') agruparPor?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const rows = await this.reportsService.margin(
      user,
      { fechaInicio, fechaFin, sucursalId },
      agruparPor === 'categoria' ? 'categoria' : 'producto',
    );

    if (format === 'csv' && res) {
      const filas = [
        ['concepto', 'cantidadVendida', 'ingresos', 'costo', 'margen', 'margenPct'],
        ...rows.map((r: Record<string, unknown>) => [
          r.nombre ?? r.categoria,
          r.cantidadVendida,
          r.ingresos,
          r.costo,
          r.margen,
          r.margenPct ?? '',
        ]),
      ];
      return enviarCsv(res, `margenes_${fechaActual()}.csv`, filas);
    }
    return rows;
  }
}

function fechaActual(): string {
  return new Date().toISOString().slice(0, 10);
}

function escaparCsv(valor: unknown): string {
  const s = String(valor ?? '');
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function enviarCsv(res: Response, nombreArchivo: string, filas: unknown[][]) {
  const csv = filas
    .map((fila) => fila.map(escaparCsv).join(','))
    .join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${nombreArchivo}"`,
  );
  return `\uFEFF${csv}`;
}
