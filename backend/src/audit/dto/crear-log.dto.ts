import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Prisma } from '@prisma/client';

/**
 * DTO para la creación de un registro de log de actividad.
 * Usado internamente por el AuditService para registrar eventos sensibles.
 */
export class CrearLogDto {
  @IsUUID()
  empresaId: string;

  @IsOptional()
  @IsString()
  sucursalId?: string;

  @IsUUID()
  usuarioId: string;

  @IsString()
  accion: string;

  @IsString()
  entidadTipo: string;

  @IsString()
  entidadId: string;

  detalles: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  severidad?: string;

  @IsOptional()
  @IsString()
  direccionIP?: string;

  @IsOptional()
  @IsString()
  agenteUsuario?: string;
}
