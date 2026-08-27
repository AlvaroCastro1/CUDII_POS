import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de Notificaciones Internas.
 * Permite a cualquier usuario autenticado consultar y gestionar sus notificaciones.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Listar notificaciones del usuario autenticado.
   * GET /notifications?soloNoLeidas=true&limit=20&page=1
   */
  @Get()
  async obtenerNotificaciones(
    @Request() req: { user: { id: string } },
    @Query('soloNoLeidas') soloNoLeidas?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.notificationsService.obtenerNotificaciones(req.user.id, {
      soloNoLeidas: soloNoLeidas === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    });
  }

  /**
   * Contar notificaciones no leídas.
   * GET /notifications/count
   */
  @Get('count')
  async contarNoLeidas(@Request() req: { user: { id: string } }) {
    return this.notificationsService.contarNoLeidas(req.user.id);
  }

  /**
   * Marcar una notificación como leída.
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  async marcarComoLeida(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.notificationsService.marcarComoLeida(id, req.user.id);
  }

  /**
   * Marcar todas las notificaciones como leídas.
   * PATCH /notifications/mark-all-read
   */
  @Patch('mark-all-read')
  async marcarTodasComoLeidas(@Request() req: { user: { id: string } }) {
    return this.notificationsService.marcarTodasComoLeidas(req.user.id);
  }
}
