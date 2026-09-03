import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSolicitudProveedorDto } from './dto/create-solicitud-proveedor.dto';
import { UpdateSolicitudProveedorDto } from './dto/update-solicitud-proveedor.dto';
import { EstadoSolicitudProveedor, Prisma } from '@prisma/client';

@Injectable()
export class SolicitudesProveedorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generar el siguiente folio atómico de solicitud para la empresa (Ej: SOL-000001)
   */
  private async generarFolio(empresaId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || this.prisma;
    const empresa = await db.empresa.update({
      where: { id: empresaId },
      data: { secuenciaSolicitudProveedor: { increment: 1 } },
      select: { secuenciaSolicitudProveedor: true },
    });
    const num = String(empresa.secuenciaSolicitudProveedor).padStart(6, '0');
    return `SOL-${num}`;
  }

  /**
   * Crear una nueva solicitud a proveedor o requisición abierta
   */
  async create(empresaId: string, usuarioId: string, dto: CreateSolicitudProveedorDto) {
    if (!dto.detalles || dto.detalles.length === 0) {
      throw new BadRequestException('La solicitud debe contener al menos un producto.');
    }

    let proveedorNombre = 'Solicitud Abierta / Sin Proveedor';
    if (dto.proveedorId) {
      const prov = await this.prisma.proveedor.findFirst({
        where: { id: dto.proveedorId, empresaId },
      });
      if (!prov) {
        throw new NotFoundException('El proveedor especificado no existe.');
      }
      proveedorNombre = prov.nombre;
    }

    return this.prisma.$transaction(async (tx) => {
      const folio = await this.generarFolio(empresaId, tx);

      let totalEstimado = 0;
      const detallesData = dto.detalles.map((item) => {
        const costo = item.costoUnitarioEstimado || 0;
        const subtotal = Number((costo * item.cantidadRequerida).toFixed(2));
        totalEstimado += subtotal;
        return {
          productoId: item.productoId,
          nombreProducto: item.nombreProducto,
          unidadMedida: item.unidadMedida || 'pieza',
          cantidadRequerida: item.cantidadRequerida,
          costoUnitarioEstimado: costo,
          subtotalEstimado: subtotal,
          notas: item.notas || null,
        };
      });

      const solicitud = await tx.solicitudProveedor.create({
        data: {
          empresaId,
          proveedorId: dto.proveedorId || null,
          creadoPorId: usuarioId,
          folio,
          estado: dto.estado || EstadoSolicitudProveedor.BORRADOR,
          fechaEntregaEsperada: dto.fechaEntregaEsperada ? new Date(dto.fechaEntregaEsperada) : null,
          notas: dto.notas || null,
          totalEstimado: Number(totalEstimado.toFixed(2)),
          detalles: {
            createMany: {
              data: detallesData,
            },
          },
        },
        include: {
          proveedor: { select: { id: true, nombre: true, rfc: true, email: true, telefono: true } },
          creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          detalles: {
            include: {
              producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
            },
          },
        },
      });

      // ── AUDITORÍA DE MOVIMIENTO ─────────────────────────────────────────────
      await this.auditService.registrarEvento({
        empresaId,
        usuarioId,
        accion: 'SOLICITUD_PROVEEDOR_CREADA',
        entidadTipo: 'solicitud_proveedor',
        entidadId: solicitud.id,
        severidad: 'info',
        detalles: {
          folio: solicitud.folio,
          proveedor: proveedorNombre,
          estado: solicitud.estado,
          totalEstimado: solicitud.totalEstimado,
          articulosCount: dto.detalles.length,
        },
      });

      return solicitud;
    });
  }

  /**
   * Listar solicitudes de productos con filtros y paginación
   */
  async findAll(
    empresaId: string,
    query: {
      proveedorId?: string;
      estado?: EstadoSolicitudProveedor;
      q?: string;
      fechaInicio?: string;
      fechaFin?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SolicitudProveedorWhereInput = { empresaId };

    if (query.proveedorId) {
      if (query.proveedorId === 'sin_proveedor') {
        where.proveedorId = null;
      } else {
        where.proveedorId = query.proveedorId;
      }
    }

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.q) {
      const qNorm = query.q.trim();
      where.OR = [
        { folio: { contains: qNorm, mode: 'insensitive' } },
        { notas: { contains: qNorm, mode: 'insensitive' } },
        { proveedor: { nombre: { contains: qNorm, mode: 'insensitive' } } },
      ];
    }

    if (query.fechaInicio || query.fechaFin) {
      where.creadoEn = {};
      if (query.fechaInicio) where.creadoEn.gte = new Date(query.fechaInicio);
      if (query.fechaFin) where.creadoEn.lte = new Date(query.fechaFin);
    }

    const [total, data] = await Promise.all([
      this.prisma.solicitudProveedor.count({ where }),
      this.prisma.solicitudProveedor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { creadoEn: 'desc' },
        include: {
          proveedor: { select: { id: true, nombre: true, rfc: true, email: true, telefono: true } },
          creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          detalles: {
            include: {
              producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
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

  /**
   * Obtener detalle completo de una solicitud por ID
   */
  async findOne(empresaId: string, id: string) {
    const solicitud = await this.prisma.solicitudProveedor.findFirst({
      where: { id, empresaId },
      include: {
        proveedor: true,
        creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
        detalles: {
          include: {
            producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true, precioCompra: true } },
          },
        },
      },
    });

    if (!solicitud) {
      throw new NotFoundException('La solicitud especificada no existe.');
    }

    return solicitud;
  }

  /**
   * Actualizar estado o datos de una solicitud
   */
  async update(empresaId: string, usuarioId: string, id: string, dto: UpdateSolicitudProveedorDto) {
    const existente = await this.findOne(empresaId, id);

    const estadoAnterior = existente.estado;
    const nuevoEstado = dto.estado || existente.estado;

    return this.prisma.$transaction(async (tx) => {
      let totalEstimado = existente.totalEstimado;

      if (dto.detalles && dto.detalles.length > 0) {
        if (existente.estado !== EstadoSolicitudProveedor.BORRADOR) {
          throw new BadRequestException('Solo se pueden modificar los artículos de una solicitud en estado BORRADOR.');
        }

        await tx.solicitudProveedorDetalle.deleteMany({
          where: { solicitudProveedorId: id },
        });

        totalEstimado = 0;
        const detallesData = dto.detalles.map((item) => {
          const costo = item.costoUnitarioEstimado || 0;
          const subtotal = Number((costo * item.cantidadRequerida).toFixed(2));
          totalEstimado += subtotal;
          return {
            solicitudProveedorId: id,
            productoId: item.productoId,
            nombreProducto: item.nombreProducto,
            unidadMedida: item.unidadMedida || 'pieza',
            cantidadRequerida: item.cantidadRequerida,
            costoUnitarioEstimado: costo,
            subtotalEstimado: subtotal,
            notas: item.notas || null,
          };
        });

        await tx.solicitudProveedorDetalle.createMany({
          data: detallesData,
        });
      }

      const actualizada = await tx.solicitudProveedor.update({
        where: { id },
        data: {
          proveedorId: dto.proveedorId !== undefined ? dto.proveedorId : existente.proveedorId,
          estado: nuevoEstado,
          fechaEntregaEsperada: dto.fechaEntregaEsperada ? new Date(dto.fechaEntregaEsperada) : existente.fechaEntregaEsperada,
          notas: dto.notas !== undefined ? dto.notas : existente.notas,
          totalEstimado: Number(totalEstimado.toFixed(2)),
        },
        include: {
          proveedor: true,
          creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
          detalles: {
            include: {
              producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } },
            },
          },
        },
      });

      // ── AUDITORÍA DE MOVIMIENTO ─────────────────────────────────────────────
      const esCambioEstado = estadoAnterior !== nuevoEstado;
      const accionLog = esCambioEstado ? 'SOLICITUD_PROVEEDOR_ESTADO_CAMBIADO' : 'SOLICITUD_PROVEEDOR_ACTUALIZADA';

      await this.auditService.registrarEvento({
        empresaId,
        usuarioId,
        accion: accionLog,
        entidadTipo: 'solicitud_proveedor',
        entidadId: actualizada.id,
        severidad: nuevoEstado === EstadoSolicitudProveedor.CANCELADA ? 'warning' : 'info',
        detalles: {
          folio: actualizada.folio,
          proveedor: actualizada.proveedor?.nombre || 'Solicitud Abierta',
          estadoAnterior,
          nuevoEstado,
          totalEstimado: actualizada.totalEstimado,
        },
      });

      return actualizada;
    });
  }

  /**
   * Eliminar una solicitud (Solo permitido en estado BORRADOR)
   */
  async remove(empresaId: string, usuarioId: string, id: string) {
    const existente = await this.findOne(empresaId, id);

    if (existente.estado !== EstadoSolicitudProveedor.BORRADOR) {
      throw new BadRequestException('Solo se pueden eliminar solicitudes en estado BORRADOR.');
    }

    await this.prisma.solicitudProveedor.delete({
      where: { id },
    });

    // ── AUDITORÍA DE ELIMINACIÓN ──────────────────────────────────────────────
    await this.auditService.registrarEvento({
      empresaId,
      usuarioId,
      accion: 'SOLICITUD_PROVEEDOR_ELIMINADA',
      entidadTipo: 'solicitud_proveedor',
      entidadId: id,
      severidad: 'warning',
      detalles: {
        folio: existente.folio,
        proveedor: existente.proveedor?.nombre || 'Solicitud Abierta',
        totalEstimado: existente.totalEstimado,
      },
    });

    return { message: 'Solicitud eliminada correctamente.' };
  }
}
