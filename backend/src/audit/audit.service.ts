import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrearLogDto } from './dto/crear-log.dto';

/**
 * Servicio centralizado de auditoría para CUDII.
 * Registra eventos inmutables de toda acción sensible del sistema
 * según REGLAS_NEGOCIO §10.3.
 *
 * Se inyecta en cualquier módulo que necesite registrar actividad:
 * cash-register, sales, returns, etc.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registrar un evento de auditoría en la tabla LogActividad.
   * @param datos Datos del evento a registrar.
   * @returns El registro de log creado.
   */
  async registrarEvento(datos: CrearLogDto) {
    return this.prisma.logActividad.create({
      data: {
        empresaId: datos.empresaId,
        sucursalId: datos.sucursalId || null,
        usuarioId: datos.usuarioId,
        accion: datos.accion,
        entidadTipo: datos.entidadTipo,
        entidadId: datos.entidadId,
        detalles: datos.detalles,
        severidad: datos.severidad || 'info',
        direccionIP: datos.direccionIP || null,
        agenteUsuario: datos.agenteUsuario || null,
      },
    });
  }

  /**
   * Buscar logs de auditoría por entidad específica.
   * @param entidadTipo Tipo de entidad (ej: 'sesion_caja', 'venta').
   * @param entidadId UUID de la entidad.
   * @returns Lista de logs ordenados por fecha descendente.
   */
  async buscarPorEntidad(entidadTipo: string, entidadId: string) {
    return this.prisma.logActividad.findMany({
      where: { entidadTipo, entidadId },
      orderBy: { fechaHora: 'desc' },
      include: {
        usuario: {
          select: { id: true, nombre: true, rol: true },
        },
      },
    });
  }

  /**
   * Buscar logs de auditoría de una empresa con filtros y paginación.
   * @param empresaId UUID de la empresa.
   * @param filtros Filtros opcionales de acción, severidad, entidad y fechas.
   * @returns Lista paginada de logs con información del usuario.
   */
  async buscarPorEmpresa(
    empresaId: string,
    filtros?: {
      accion?: string;
      severidad?: string;
      entidadTipo?: string;
      fechaInicio?: string;
      fechaFin?: string;
      limite?: number;
      pagina?: number;
    },
  ) {
    const where: Prisma.LogActividadWhereInput = { empresaId };

    if (filtros?.accion) {
      where.accion = filtros.accion;
    }
    if (filtros?.severidad) {
      where.severidad = filtros.severidad;
    }
    if (filtros?.entidadTipo) {
      where.entidadTipo = filtros.entidadTipo;
    }
    if (filtros?.fechaInicio || filtros?.fechaFin) {
      where.fechaHora = {};
      if (filtros.fechaInicio)
        where.fechaHora.gte = new Date(filtros.fechaInicio);
      if (filtros.fechaFin) where.fechaHora.lte = new Date(filtros.fechaFin);
    }

    const limite = Math.min(filtros?.limite || 50, 100);
    const pagina = filtros?.pagina || 1;
    const skip = (pagina - 1) * limite;

    const [total, datos] = await Promise.all([
      this.prisma.logActividad.count({ where }),
      this.prisma.logActividad.findMany({
        where,
        skip,
        take: limite,
        orderBy: { fechaHora: 'desc' },
        include: {
          usuario: {
            select: { id: true, nombre: true, rol: true },
          },
        },
      }),
    ]);

    const totalPaginas = Math.ceil(total / limite) || 1;

    return {
      datos,
      meta: {
        total,
        page: pagina,
        limit: limite,
        totalPages: totalPaginas,
        hasNextPage: pagina < totalPaginas,
        hasPrevPage: pagina > 1,
      },
    };
  }

  /**
   * Buscar logs de auditoría por usuario con filtros opcionales.
   * @param usuarioId UUID del usuario.
   * @param filtros Filtros opcionales de acción y rango de fechas.
   * @returns Lista paginada de logs.
   */
  async buscarPorUsuario(
    usuarioId: string,
    filtros?: {
      accion?: string;
      fechaInicio?: string;
      fechaFin?: string;
      limite?: number;
    },
  ) {
    const where: Record<string, unknown> = { usuarioId };

    if (filtros?.accion) {
      where.accion = filtros.accion;
    }

    if (filtros?.fechaInicio || filtros?.fechaFin) {
      const fechaHora: Record<string, Date> = {};
      if (filtros?.fechaInicio) fechaHora.gte = new Date(filtros.fechaInicio);
      if (filtros?.fechaFin) fechaHora.lte = new Date(filtros.fechaFin);
      where.fechaHora = fechaHora;
    }

    return this.prisma.logActividad.findMany({
      where,
      take: filtros?.limite || 50,
      orderBy: { fechaHora: 'desc' },
      include: {
        usuario: {
          select: { id: true, nombre: true, rol: true },
        },
      },
    });
  }
}
