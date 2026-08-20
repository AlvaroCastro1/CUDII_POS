import { BadRequestException } from '@nestjs/common';
import { MetodoRotacion, Prisma } from '@prisma/client';
import { redondearSegunUnidad } from '../common/validators/unidad.util';

export interface LoteConsumido {
  loteId: string;
  cantidad: number;
  costoUnitario: number;
  codigoLote: string;
}

/**
 * Genera un código de lote legible cuando el usuario no captura uno.
 * Formato: L-<últimos 6 del código de barras>-<sufijo aleatorio>
 */
export function generarCodigoLote(codigoBarras: string): string {
  const base = codigoBarras ? codigoBarras.slice(-6) : 'GEN';
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `L-${base}-${sufijo}`;
}

/**
 * Consume stock de un producto con manejo de lotes aplicando la rotación
 * del producto (FEFO por defecto: primero lo que caduca antes).
 *
 * Excluye lotes vencidos (fechaCaducidad < hoy) y agotados. Devuelve la
 * asignación lote por lote (cantidad y costo unitario de cada lote).
 *
 * No modifica el agregado InventarioSucursal: el llamador lo descuenta.
 *
 * @param unidadMedida Unidad de medida del producto. Si es discreta (pieza, caja, etc.)
 *                     las cantidades consumidas se redondean a enteros.
 */
export async function consumirLotes(
  tx: Prisma.TransactionClient,
  productoId: string,
  sucursalId: string,
  cantidad: number,
  unidadMedida?: string,
): Promise<LoteConsumido[]> {
  if (cantidad <= 0) return [];

  const producto = await tx.producto.findUnique({
    where: { id: productoId },
    select: { metodoRotacion: true, manejaInventario: true, codigoBarras: true, unidadMedida: true },
  });

  if (!producto || !producto.manejaInventario) return [];

  const unidad = unidadMedida || producto.unidadMedida;

  const ahora = new Date();

  const ordenFEFO: Prisma.LoteOrderByWithRelationInput[] = [
    { fechaCaducidad: { sort: 'asc', nulls: 'last' } },
    { fechaRecepcion: 'asc' },
  ];
  const ordenFIFO: Prisma.LoteOrderByWithRelationInput[] = [
    { fechaRecepcion: 'asc' },
    { fechaCaducidad: { sort: 'asc', nulls: 'last' } },
  ];

  const lotes = await tx.lote.findMany({
    where: {
      productoId,
      sucursalId,
      estado: 'activo',
      cantidadRestante: { gt: 0 },
      OR: [{ fechaCaducidad: null }, { fechaCaducidad: { gte: ahora } }],
    },
    orderBy:
      producto.metodoRotacion === MetodoRotacion.FIFO ? ordenFIFO : ordenFEFO,
  });

  const consumido: LoteConsumido[] = [];
  let restante = redondearSegunUnidad(cantidad, unidad);

  if (lotes.length === 0) {
    const inv = await tx.inventarioSucursal.findFirst({
      where: { productoId, sucursalId },
    });
    if (!inv || inv.stockActual <= 0) return consumido;

    const empresa = await tx.empresa.findFirst();
    const admin = await tx.usuario.findFirst({ where: { rol: 'SUPER_ADMIN' } });
    if (!empresa || !admin) return consumido;

    const stockOriginal = inv.stockActual + restante;

    const loteAuto = await tx.lote.create({
      data: {
        empresaId: empresa.id,
        productoId,
        sucursalId,
        codigoLote: generarCodigoLote(producto.codigoBarras),
        fechaRecepcion: ahora,
        fechaCaducidad: null,
        cantidadInicial: redondearSegunUnidad(stockOriginal, unidad),
        cantidadRestante: redondearSegunUnidad(stockOriginal, unidad),
        costoUnitario: 0,
        estado: 'activo',
        creadoPorId: admin.id,
      },
    });

    await tx.movimientoInventario.create({
      data: {
        productoId,
        sucursalId,
        loteId: loteAuto.id,
        tipo: 'apertura_inicial',
        cantidad: redondearSegunUnidad(stockOriginal, unidad),
        stockAnterior: 0,
        stockNuevo: redondearSegunUnidad(stockOriginal, unidad),
        motivo: 'Apertura automática de lote desde inventario existente',
        usuarioId: admin.id,
      },
    });

    const toma = Math.min(redondearSegunUnidad(stockOriginal, unidad), restante);
    await tx.lote.update({
      where: { id: loteAuto.id },
      data: {
        cantidadRestante: { decrement: toma },
        estado: redondearSegunUnidad(stockOriginal, unidad) - toma <= 0 ? 'agotado' : 'activo',
        actualizadoEn: ahora,
      },
    });

    consumido.push({
      loteId: loteAuto.id,
      cantidad: toma,
      costoUnitario: 0,
      codigoLote: loteAuto.codigoLote,
    });
    return consumido;
  }

  for (const lote of lotes) {
    if (restante <= 0) break;
    const toma = redondearSegunUnidad(
      Math.min(lote.cantidadRestante, restante),
      unidad,
    );
    if (toma <= 0) continue;

    await tx.lote.update({
      where: { id: lote.id },
      data: {
        cantidadRestante: { decrement: toma },
        estado: lote.cantidadRestante - toma <= 0 ? 'agotado' : 'activo',
        actualizadoEn: ahora,
      },
    });

    consumido.push({
      loteId: lote.id,
      cantidad: toma,
      costoUnitario: lote.costoUnitario,
      codigoLote: lote.codigoLote,
    });
    restante -= toma;
  }

  if (restante > 0) {
    throw new BadRequestException(
      `Stock insuficiente en lotes. Disponible: ${cantidad - restante}, solicitado: ${cantidad}`,
    );
  }

  return consumido;
}
