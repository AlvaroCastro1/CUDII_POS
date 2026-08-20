import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoLote,
  Prisma,
  TipoMovimientoInventario,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrearMermaDto } from './dto/crear-merma.dto';
import { consumirLotes } from '../inventory/lotes.helper';

@Injectable()
export class MermaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registrar una baja por merma. Descuenta del lote (FEFO si no se indica)
   * y del inventario agregado, y valúa la merma con el costo del lote.
   */
  async registrarMerma(
    dto: CrearMermaDto,
    empresaId: string,
    usuarioId: string,
  ) {
    const sucursal = await this.prisma.sucursal.findFirst({
      where: { id: dto.sucursalId, empresaId },
    });
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const producto = await this.prisma.producto.findFirst({
      where: { id: dto.productoId, empresaId, estaActivo: true },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      let loteId: string | null = null;
      let costoUnitario = producto.precioCompra || 0;

      // Atribuir la merma a un lote
      if (dto.loteId) {
        const lote = await tx.lote.findFirst({
          where: {
            id: dto.loteId,
            productoId: dto.productoId,
            sucursalId: dto.sucursalId,
            empresaId,
          },
        });
        if (!lote) {
          throw new NotFoundException('Lote no encontrado');
        }
        if (dto.cantidad > lote.cantidadRestante) {
          throw new BadRequestException(
            `Cantidad solicitada (${dto.cantidad}) excede el stock disponible en el lote (${lote.cantidadRestante})`,
          );
        }
        await tx.lote.update({
          where: { id: lote.id },
          data: {
            cantidadRestante: { decrement: dto.cantidad },
            estado:
              lote.cantidadRestante - dto.cantidad <= 0
                ? EstadoLote.agotado
                : lote.fechaCaducidad &&
                    lote.fechaCaducidad < new Date()
                  ? EstadoLote.vencido
                  : EstadoLote.activo,
            actualizadoEn: new Date(),
          },
        });
        loteId = lote.id;
        costoUnitario = lote.costoUnitario;
      } else if (producto.manejaInventario) {
        const consumidos = await consumirLotes(
          tx,
          dto.productoId,
          dto.sucursalId,
          dto.cantidad,
        );
        loteId = consumidos[0]?.loteId || null;
        if (consumidos.length > 0) {
          costoUnitario = consumidos[0].costoUnitario;
        }
      }

      // Descontar del inventario agregado
      let inventario = await tx.inventarioSucursal.findUnique({
        where: {
          sucursalId_productoId: {
            sucursalId: dto.sucursalId,
            productoId: dto.productoId,
          },
        },
      });

      const stockAnterior = inventario ? inventario.stockActual : 0;
      const stockNuevo = stockAnterior - dto.cantidad;

      if (inventario) {
        inventario = await tx.inventarioSucursal.update({
          where: {
            sucursalId_productoId: {
              sucursalId: dto.sucursalId,
              productoId: dto.productoId,
            },
          },
          data: { stockActual: stockNuevo, ultimoMovimiento: new Date() },
        });
      } else {
        inventario = await tx.inventarioSucursal.create({
          data: {
            productoId: dto.productoId,
            sucursalId: dto.sucursalId,
            stockActual: stockNuevo,
          },
        });
      }

      // Registro de merma
      const merma = await tx.merma.create({
        data: {
          empresaId,
          sucursalId: dto.sucursalId,
          productoId: dto.productoId,
          loteId,
          cantidad: dto.cantidad,
          motivo: dto.motivo,
          costoUnitario,
          costoTotal: costoUnitario * dto.cantidad,
          notas: dto.notas || null,
          usuarioId,
        },
        include: {
          producto: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true } },
          lote: { select: { id: true, codigoLote: true } },
        },
      });

      // Movimiento de inventario tipo merma
      await tx.movimientoInventario.create({
        data: {
          productoId: dto.productoId,
          sucursalId: dto.sucursalId,
          loteId,
          tipo: TipoMovimientoInventario.merma,
          cantidad: dto.cantidad,
          stockAnterior,
          stockNuevo,
          referencia: merma.id,
          motivo: `Merma (${dto.motivo})`,
          usuarioId,
        },
      });

      return merma;
    });
  }

  async findAllMermas(
    empresaId: string,
    query: { sucursalId?: string; productoId?: string; desde?: string; hasta?: string },
  ) {
    const where: Prisma.MermaWhereInput = { empresaId };

    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.productoId) where.productoId = query.productoId;

    if (query.desde || query.hasta) {
      where.fechaHora = {};
      if (query.desde) where.fechaHora.gte = new Date(query.desde);
      if (query.hasta) where.fechaHora.lte = new Date(query.hasta);
    }

    return this.prisma.merma.findMany({
      where,
      orderBy: { fechaHora: 'desc' },
      include: {
        producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
        sucursal: { select: { id: true, nombre: true } },
        lote: { select: { id: true, codigoLote: true, fechaCaducidad: true } },
        usuario: { select: { id: true, nombre: true } },
      },
    });
  }
}
