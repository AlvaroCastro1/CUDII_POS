import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Rol } from '@prisma/client';

/**
 * Datos para crear una notificación interna.
 */
interface CrearNotificacionDatos {
  empresaId: string;
  destinatarioId: string;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'warning' | 'critical';
  evento: string;
  entidadTipo?: string;
  entidadId?: string;
}

/**
 * Servicio de Notificaciones Internas de CUDII (MVP).
 *
 * En esta fase, las notificaciones se almacenan en la BD y se consultan
 * vía polling desde el frontend (campana de notificaciones).
 *
 * En Fase 4 se agregarán adaptadores de canales externos
 * (Telegram, WhatsApp, Email) usando el patrón Strategy.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una notificación individual para un usuario.
   * @param datos Datos de la notificación a crear.
   * @returns La notificación creada.
   */
  async crearNotificacion(datos: CrearNotificacionDatos) {
    return this.prisma.notificacion.create({
      data: {
        empresaId: datos.empresaId,
        destinatarioId: datos.destinatarioId,
        titulo: datos.titulo,
        mensaje: datos.mensaje,
        tipo: datos.tipo,
        evento: datos.evento,
        entidadTipo: datos.entidadTipo || null,
        entidadId: datos.entidadId || null,
      },
    });
  }

  /**
   * Notificar a todos los ADMIN y GERENTE de una empresa.
   * Crea una notificación por cada usuario con rol ADMIN, GERENTE o SUPER_ADMIN.
   * @param empresaId UUID de la empresa.
   * @param payload Datos de la notificación (sin destinatario, se asigna automáticamente).
   */
  async notificarAdminsYGerentes(
    empresaId: string,
    payload: Omit<CrearNotificacionDatos, 'empresaId' | 'destinatarioId'>,
  ) {
    const destinatarios = await this.prisma.usuario.findMany({
      where: {
        empresaId,
        estaActivo: true,
        rol: { in: [Rol.SUPER_ADMIN, Rol.ADMIN, Rol.GERENTE] },
      },
      select: { id: true },
    });

    if (destinatarios.length === 0) return;

    await this.prisma.notificacion.createMany({
      data: destinatarios.map((dest) => ({
        empresaId,
        destinatarioId: dest.id,
        titulo: payload.titulo,
        mensaje: payload.mensaje,
        tipo: payload.tipo,
        evento: payload.evento,
        entidadTipo: payload.entidadTipo || null,
        entidadId: payload.entidadId || null,
      })),
    });
  }

  /**
   * Obtener notificaciones de un usuario con paginación.
   * @param usuarioId UUID del usuario autenticado.
   * @param filtros Filtros opcionales.
   * @returns Lista paginada de notificaciones.
   */
  async obtenerNotificaciones(
    usuarioId: string,
    filtros?: {
      soloNoLeidas?: boolean;
      limite?: number;
      pagina?: number;
    },
  ) {
    const limite = filtros?.limite || 20;
    const pagina = filtros?.pagina || 1;
    const skip = (pagina - 1) * limite;

    const where: Record<string, unknown> = { destinatarioId: usuarioId };
    if (filtros?.soloNoLeidas) {
      where.leida = false;
    }

    const [total, notificaciones] = await Promise.all([
      this.prisma.notificacion.count({ where }),
      this.prisma.notificacion.findMany({
        where,
        skip,
        take: limite,
        orderBy: { fechaHora: 'desc' },
      }),
    ]);

    return {
      datos: notificaciones,
      meta: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  /**
   * Contar notificaciones no leídas de un usuario.
   * @param usuarioId UUID del usuario.
   * @returns Objeto con el conteo de no leídas.
   */
  async contarNoLeidas(usuarioId: string) {
    const cantidad = await this.prisma.notificacion.count({
      where: {
        destinatarioId: usuarioId,
        leida: false,
      },
    });

    return { noLeidas: cantidad };
  }

  /**
   * Marcar una notificación como leída.
   * @param id UUID de la notificación.
   * @param usuarioId UUID del usuario (para validar propiedad).
   * @returns La notificación actualizada.
   */
  async marcarComoLeida(id: string, usuarioId: string) {
    return this.prisma.notificacion.updateMany({
      where: { id, destinatarioId: usuarioId },
      data: { leida: true },
    });
  }

  /**
   * Marcar todas las notificaciones del usuario como leídas.
   * @param usuarioId UUID del usuario.
   * @returns Conteo de notificaciones actualizadas.
   */
  async marcarTodasComoLeidas(usuarioId: string) {
    return this.prisma.notificacion.updateMany({
      where: {
        destinatarioId: usuarioId,
        leida: false,
      },
      data: { leida: true },
    });
  }
}
