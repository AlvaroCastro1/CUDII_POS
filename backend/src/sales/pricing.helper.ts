import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, TipoPrecioCombo } from '@prisma/client';

/** Redondea un número a 2 decimales (evita artefactos de punto flotante). */
const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Distribuye un monto total (en $) entre partes de forma proporcional (método
 * del mayor residuo), garantizando que la suma de las partes sea exactamente
 * igual al total, trabajando en centavos para evitar artefactos de flotante.
 */
export function distribuirMonto(total: number, shares: number[]): number[] {
  const n = shares.length;
  if (total <= 0 || n === 0 || shares.every((s) => s <= 0)) {
    return shares.map(() => 0);
  }
  const suma = shares.reduce((a, b) => a + b, 0);
  const totalCentavos = Math.round(total * 100);
  const partes = shares.map((s) => (s / suma) * totalCentavos);
  const enteros = partes.map(Math.floor);
  const fracciones = partes
    .map((p, i) => ({ i, frac: p - enteros[i] }))
    .sort((a, b) => b.frac - a.frac);
  const yaAsignado = enteros.reduce((a, b) => a + b, 0);
  let restante = totalCentavos - yaAsignado;
  let cursor = 0;
  while (restante > 0) {
    enteros[fracciones[cursor % n].i] += 1;
    restante -= 1;
    cursor += 1;
  }
  return enteros.map((c) => c / 100);
}

/** Línea de venta interna (producto suelto o expandida desde un combo). */
export interface LineaVenta {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  unidadMedida?: string;
  descuento?: number;
  comboId?: string;
  nombreCombo?: string;
}

/**
 * D12: Expande los combos pedidos en líneas internas de producto con precios
 * autoritativos tomados de la BD (nunca del cliente), repartiendo el ahorro del
 * combo proporcionalmente entre sus productos. Es el mismo motor que usa la
 * venta, compartido con presupuestos para que ambos jamás diverjan.
 */
export async function expandirCombos(
  tx: Prisma.TransactionClient,
  combosDto: { comboId: string; cantidad: number }[],
  empresaId: string,
): Promise<LineaVenta[]> {
  const acumulador = new Map<string, number>();
  for (const c of combosDto) {
    if (!c.cantidad || c.cantidad < 1) {
      throw new BadRequestException(
        'La cantidad de cada combo debe ser mayor a cero',
      );
    }
    acumulador.set(c.comboId, (acumulador.get(c.comboId) ?? 0) + c.cantidad);
  }

  const combos = await tx.combo.findMany({
    where: { id: { in: [...acumulador.keys()] }, empresaId, activo: true },
    include: {
      productos: {
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              precioVentaBase: true,
              unidadMedida: true,
              estaActivo: true,
            },
          },
        },
      },
    },
  });
  const combosMap = new Map(combos.map((c) => [c.id, c]));
  const salida: LineaVenta[] = [];

  for (const [comboId, cantidad] of acumulador) {
    const combo = combosMap.get(comboId);
    if (!combo) {
      throw new NotFoundException(
        'El combo no fue encontrado o está desactivado',
      );
    }

    const ahora = new Date();
    if (combo.fechaInicio && ahora < combo.fechaInicio) {
      throw new BadRequestException(
        `El combo "${combo.nombre}" aún no está vigente`,
      );
    }
    if (combo.fechaFin && ahora > combo.fechaFin) {
      throw new BadRequestException(
        `El combo "${combo.nombre}" ha caducado`,
      );
    }

    for (const cp of combo.productos) {
      if (!cp.producto.estaActivo) {
        throw new BadRequestException(
          `El producto "${cp.producto.nombre}" está inactivo y no puede venderse en el combo "${combo.nombre}"`,
        );
      }
    }

    const precioOriginalCombo = redondear2(
      combo.productos.reduce(
        (acc, cp) => acc + cp.producto.precioVentaBase * cp.cantidad,
        0,
      ),
    );
    const precioComboUnitario =
      combo.tipoPrecio === TipoPrecioCombo.MONTO_FIJO
        ? redondear2(combo.valorPrecio)
        : redondear2(precioOriginalCombo * (1 - combo.valorPrecio / 100));
    const ahorroUnitario = redondear2(
      precioOriginalCombo - precioComboUnitario,
    );
    const ahorroTotal = redondear2(ahorroUnitario * cantidad);

    const expansiones = combo.productos.map((cp) => {
      const producto = cp.producto;
      const cantidadLinea = cp.cantidad * cantidad;
      return {
        subtotal: redondear2(producto.precioVentaBase * cantidadLinea),
        linea: {
          productoId: producto.id,
          cantidad: cantidadLinea,
          precioUnitario: producto.precioVentaBase,
          unidadMedida: producto.unidadMedida,
          comboId: combo.id,
          nombreCombo: combo.nombre,
        },
      };
    });

    const descuentos = distribuirMonto(
      ahorroTotal,
      expansiones.map((e) => e.subtotal),
    );
    expansiones.forEach((e, i) => {
      salida.push({ ...e.linea, descuento: descuentos[i] });
    });
  }

  return salida;
}
