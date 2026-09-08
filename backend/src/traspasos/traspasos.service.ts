import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTraspasoDto } from './dto/create-traspaso.dto';
import { RecibirTraspasoDto } from './dto/recibir-traspaso.dto';
import { EstadoTraspaso, Prisma } from '@prisma/client';

@Injectable()
export class TraspasosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async generarFolio(empresaId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || this.prisma;
    const empresa = await db.empresa.update({
      where: { id: empresaId },
      data: { secuenciaTraspaso: { increment: 1 } },
      select: { secuenciaTraspaso: true },
    });
    const num = String(empresa.secuenciaTraspaso).padStart(6, '0');
    return `TRASP-${num}`;
  }

  async create(empresaId: string, usuarioId: string, dto: CreateTraspasoDto) {
    if (dto.sucursalOrigenId === dto.sucursalDestinoId) {
      throw new BadRequestException('La sucursal de origen y destino no pueden ser la misma.');
    }

    if (!dto.detalles || dto.detalles.length === 0) {
      throw new BadRequestException('El traspaso debe contener al menos un producto.');
    }

    const [origen, destino] = await Promise.all([
      this.prisma.sucursal.findFirst({ where: { id: dto.sucursalOrigenId, empresaId } }),
      this.prisma.sucursal.findFirst({ where: { id: dto.sucursalDestinoId, empresaId } }),
    ]);

    if (!origen || !destino) {
      throw new NotFoundException('Las sucursales especificadas deben existir en la empresa.');
    }

    const estadoInicial = dto.estado || EstadoTraspaso.EN_TRANSITO;

    return this.prisma.$transaction(async (tx) => {
      const folio = await this.generarFolio(empresaId, tx);

      const detallesData = dto.detalles.map((item) => ({
        productoId: item.productoId,
        loteId: item.loteId || null,
        nombreProducto: item.nombreProducto,
        unidadMedida: item.unidadMedida || 'pieza',
        cantidadEnviada: item.cantidadEnviada,
        cantidadRecibida: 0,
      }));

      const traspaso = await tx.traspaso.create({
        data: {
          empresaId,
          sucursalOrigenId: dto.sucursalOrigenId,
          sucursalDestinoId: dto.sucursalDestinoId,
          creadoPorId: usuarioId,
          folio,
          secuenciaFolio: parseInt(folio.replace('TRASP-', ''), 10) || 0,
          estado: estadoInicial,
          notasEmision: dto.notasEmision || null,
          fechaSalida: estadoInicial === EstadoTraspaso.EN_TRANSITO ? new Date() : null,
          detalles: {
            createMany: {
              data: detallesData,
            },
          },
        },
        include: {
          sucursalOrigen: true,
          sucursalDestino: true,
          creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          detalles: true,
        },
      });

      if (estadoInicial === EstadoTraspaso.EN_TRANSITO) {
        for (const item of dto.detalles) {
          const inv = await tx.inventarioSucursal.findUnique({
            where: {
              sucursalId_productoId: {
                sucursalId: dto.sucursalOrigenId,
                productoId: item.productoId,
              },
            },
          });

          if (inv) {
            await tx.inventarioSucursal.update({
              where: { id: inv.id },
              data: { stockActual: { decrement: item.cantidadEnviada } },
            });
          }

          if (item.loteId) {
            await tx.lote.update({
              where: { id: item.loteId },
              data: { cantidadRestante: { decrement: item.cantidadEnviada } },
            });
          }

          await tx.movimientoInventario.create({
            data: {
              sucursalId: dto.sucursalOrigenId,
              productoId: item.productoId,
              loteId: item.loteId || null,
              usuarioId,
              tipo: 'SALIDA_TRASPASO',
              cantidad: item.cantidadEnviada,
              motivo: `Salida por traspaso ${folio} a ${destino.nombre}`,
            },
          });
        }
      }

      await this.auditService.registrarEvento({
        empresaId,
        sucursalId: dto.sucursalOrigenId,
        usuarioId,
        accion: 'TRASPASO_CREADO',
        entidadTipo: 'traspaso',
        entidadId: traspaso.id,
        severidad: 'info',
        detalles: {
          folio: traspaso.folio,
          origen: origen.nombre,
          destino: destino.nombre,
          estado: traspaso.estado,
          articulosCount: dto.detalles.length,
        },
      });

      return traspaso;
    });
  }

  async findAll(
    empresaId: string,
    query: {
      sucursalOrigenId?: string;
      sucursalDestinoId?: string;
      estado?: EstadoTraspaso;
      q?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TraspasoWhereInput = { empresaId };

    if (query.sucursalOrigenId) where.sucursalOrigenId = query.sucursalOrigenId;
    if (query.sucursalDestinoId) where.sucursalDestinoId = query.sucursalDestinoId;
    if (query.estado) where.estado = query.estado;

    if (query.q) {
      const qNorm = query.q.trim();
      where.OR = [
        { folio: { contains: qNorm, mode: 'insensitive' } },
        { notasEmision: { contains: qNorm, mode: 'insensitive' } },
        { notasRecepcion: { contains: qNorm, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.traspaso.count({ where }),
      this.prisma.traspaso.findMany({
        where,
        skip,
        take: limit,
        orderBy: { creadoEn: 'desc' },
        include: {
          sucursalOrigen: true,
          sucursalDestino: true,
          creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          recibidoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          detalles: {
            include: {
              producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
              lote: { select: { id: true, codigoLote: true, fechaCaducidad: true } },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(empresaId: string, id: string) {
    const traspaso = await this.prisma.traspaso.findFirst({
      where: { id, empresaId },
      include: {
        sucursalOrigen: true,
        sucursalDestino: true,
        creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
        recibidoPor: { select: { id: true, nombre: true, email: true, rol: true } },
        detalles: {
          include: {
            producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
            lote: true,
          },
        },
      },
    });

    if (!traspaso) {
      throw new NotFoundException('El traspaso especificado no existe.');
    }

    return traspaso;
  }

  async recibir(empresaId: string, usuarioId: string, id: string, dto: RecibirTraspasoDto) {
    const traspaso = await this.findOne(empresaId, id);

    if (traspaso.estado !== EstadoTraspaso.EN_TRANSITO) {
      throw new BadRequestException('Solo se pueden recibir traspasos que estén en estado EN_TRANSITO.');
    }

    return this.prisma.$transaction(async (tx) => {
      let hayDiscrepancias = false;

      for (const item of dto.detalles) {
        const detalle = traspaso.detalles.find((d) => d.id === item.detalleId);
        if (!detalle) continue;

        if (item.cantidadRecibida !== detalle.cantidadEnviada) {
          hayDiscrepancias = true;
        }

        await tx.traspasoDetalle.update({
          where: { id: detalle.id },
          data: { cantidadRecibida: item.cantidadRecibida },
        });

        if (item.cantidadRecibida > 0) {
          const invDestino = await tx.inventarioSucursal.findUnique({
            where: {
              sucursalId_productoId: {
                sucursalId: traspaso.sucursalDestinoId,
                productoId: detalle.productoId,
              },
            },
          });

          if (invDestino) {
            await tx.inventarioSucursal.update({
              where: { id: invDestino.id },
              data: { stockActual: { increment: item.cantidadRecibida } },
            });
          } else {
            await tx.inventarioSucursal.create({
              data: {
                sucursalId: traspaso.sucursalDestinoId,
                productoId: detalle.productoId,
                stockActual: item.cantidadRecibida,
                stockMinimo: 5,
                stockMaximo: 100,
              },
            });
          }

          let loteDestinoId: string | null = null;
          if (detalle.lote) {
            const codigoLoteDestino = `${detalle.lote.codigoLote}-TR`;
            let loteDest = await tx.lote.findFirst({
              where: {
                empresaId,
                sucursalId: traspaso.sucursalDestinoId,
                productoId: detalle.productoId,
                codigoLote: codigoLoteDestino,
              },
            });

            if (!loteDest) {
              loteDest = await tx.lote.create({
                data: {
                  empresaId,
                  sucursalId: traspaso.sucursalDestinoId,
                  productoId: detalle.productoId,
                  codigoLote: codigoLoteDestino,
                  fechaFabricacion: detalle.lote.fechaFabricacion,
                  fechaCaducidad: detalle.lote.fechaCaducidad,
                  cantidadInicial: item.cantidadRecibida,
                  cantidadRestante: item.cantidadRecibida,
                  costoUnitario: detalle.lote.costoUnitario,
                  creadoPorId: usuarioId,
                },
              });
            } else {
              await tx.lote.update({
                where: { id: loteDest.id },
                data: {
                  cantidadInicial: { increment: item.cantidadRecibida },
                  cantidadRestante: { increment: item.cantidadRecibida },
                },
              });
            }
            loteDestinoId = loteDest.id;
          }

          await tx.movimientoInventario.create({
            data: {
              sucursalId: traspaso.sucursalDestinoId,
              productoId: detalle.productoId,
              loteId: loteDestinoId,
              usuarioId,
              tipo: 'ENTRADA_TRASPASO',
              cantidad: item.cantidadRecibida,
              motivo: `Entrada por traspaso ${traspaso.folio} desde ${traspaso.sucursalOrigen.nombre}`,
            },
          });
        }
      }

      const nuevoEstado = hayDiscrepancias ? EstadoTraspaso.RECIBIDO_PARCIAL : EstadoTraspaso.RECIBIDO;

      const actualizado = await tx.traspaso.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          recibidoPorId: usuarioId,
          fechaRecepcion: new Date(),
          notasRecepcion: dto.notasRecepcion || null,
        },
        include: {
          sucursalOrigen: true,
          sucursalDestino: true,
          detalles: true,
        },
      });

      await this.auditService.registrarEvento({
        empresaId,
        sucursalId: traspaso.sucursalDestinoId,
        usuarioId,
        accion: 'TRASPASO_RECIBIDO',
        entidadTipo: 'traspaso',
        entidadId: id,
        severidad: hayDiscrepancias ? 'warning' : 'info',
        detalles: {
          folio: traspaso.folio,
          origen: traspaso.sucursalOrigen.nombre,
          destino: traspaso.sucursalDestino.nombre,
          estado: nuevoEstado,
          hayDiscrepancias,
        },
      });

      return actualizado;
    });
  }
}
