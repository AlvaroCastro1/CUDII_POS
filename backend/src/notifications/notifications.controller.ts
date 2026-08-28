import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';

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
    @CurrentUser() user: CurrentUserPayload,
    @Query('soloNoLeidas') soloNoLeidas?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.notificationsService.obtenerNotificaciones(user.id, {
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
  async contarNoLeidas(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.contarNoLeidas(user.id);
  }

  /**
   * Marcar una notificación como leída.
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  async marcarComoLeida(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.notificationsService.marcarComoLeida(id, user.id);
  }

  /**
   * Marcar todas las notificaciones como leídas.
   * PATCH /notifications/mark-all-read
   */
  @Patch('mark-all-read')
  async marcarTodasComoLeidas(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.marcarTodasComoLeidas(user.id);
  }
}
