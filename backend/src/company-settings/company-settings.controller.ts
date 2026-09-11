import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { CompanySettingsService } from './company-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ConfiguracionWhitelabelDto } from './dto/whitelabel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces/jwt-payload.interface';
import { Public } from '../auth/decorators/public.decorator';


type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
type DestinationCallback = (error: Error | null, destination: string) => void;
type FileNameCallback = (error: Error | null, filename: string) => void;

/** Tipo parcial compatible con Express.Multer.File para los callbacks de diskStorage. */
interface MulterFileInfo {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size?: number;
}

/** Request parcial que solo necesita user.empresaId para construir la ruta multitenant. */
interface MulterRequest {
  user?: { empresaId?: string };
}

export interface ArchivoSubido {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
}

@Controller('company-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  /**
   * Configuración completa del sitio (solo ADMIN/SUPER_ADMIN).
   * Incluye el bloque del Programa de Lealtad (D10) con sus niveles.
   */
  @Get()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  async getSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getSettings(user.empresaId);
  }

  @Patch()
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  async updateSettings(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.companySettingsService.updateSettings(user.empresaId, dto);
  }

  /**
   * D10: Configuración del Programa de Lealtad accesible a todos los roles
   * autenticados. El POS la necesita para mostrar puntos, niveles y descuentos.
   * Solo lectura; la edición sigue restringida al PATCH anterior.
   */
  @Get('lealtad')
  async getProgramaLealtad(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getProgramaLealtad(user.empresaId);
  }

  /**
   * Configuración de estilos de tickets accesible a todos los usuarios autenticados
   * para el formateo de comprobantes e impresión en terminales POS.
   */
  @Get('ticket')
  async getConfiguracionTicket(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getConfiguracionTicket(user.empresaId);
  }

  /**
   * Sube una imagen de logo para la empresa (solo ADMIN/SUPER_ADMIN).
   * Almacena el archivo en /uploads/logos/empresa_<empresaId>/ garantizando aislamiento multitenant.
   * Elimina automáticamente cualquier logo anterior no utilizado de esta empresa.
   */
  @Post('logo-upload')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // Máximo 5 MB
      fileFilter: (_req: MulterRequest, file: MulterFileInfo, cb: FileFilterCallback) => {
        if (!file.mimetype.match(/^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/)) {
          return cb(
            new BadRequestException(
              'Solo se permiten imágenes (PNG, JPG, WEBP, GIF, SVG)',
            ),
            false,
          );
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (req: MulterRequest, _file: MulterFileInfo, cb: DestinationCallback) => {
          try {
            const empresaId = req.user?.empresaId || 'default';
            const uploadDir = join(
              process.cwd(),
              'uploads',
              'logos',
              `empresa_${empresaId}`,
            );
            if (!existsSync(uploadDir)) {
              mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
          } catch (err: unknown) {
            const codigo = (err as NodeJS.ErrnoException)?.code;
            if (codigo === 'ENOSPC') {
              return cb(
                new BadRequestException(
                  'En este momento no podemos subir el archivo debido al espacio insuficiente.',
                ),
                '',
              );
            }
            cb(err as Error, '');
          }
        },
        filename: (_req: MulterRequest, file: MulterFileInfo, cb: FileNameCallback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `logo_${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadLogo(
    @UploadedFile() file: ArchivoSubido,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException(
        'El archivo es inválido, supera el límite o no se recibió correctamente.',
      );
    }

    const publicUrl = `/uploads/logos/empresa_${user.empresaId}/${file.filename}`;

    // Eliminar logos anteriores de esta empresa que ya no se utilizan
    await this.companySettingsService.limpiarArchivosLogoNoUsados(
      user.empresaId,
      publicUrl,
    );

    return { url: publicUrl };
  }

  // ─── Endpoints Whitelabel ────────────────────────────────────────────────────

  /**
   * Devuelve la configuración Whitelabel de la empresa autenticada.
   * Accesible por todos los roles autenticados (POS, Dashboard, etc.).
   */
  @Get('whitelabel')
  async getWhitelabel(@CurrentUser() user: CurrentUserPayload) {
    return this.companySettingsService.getWhitelabel(user.empresaId);
  }

  /**
   * Actualiza la configuración Whitelabel de la empresa autenticada.
   * Solo ADMIN y SUPER_ADMIN pueden modificar la identidad visual.
   */
  @Patch('whitelabel')
  @Roles(Rol.ADMIN, Rol.SUPER_ADMIN)
  async updateWhitelabel(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: ConfiguracionWhitelabelDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.companySettingsService.updateWhitelabel(user.empresaId, dto);
  }

  /**
   * Endpoint público (sin JWT) para que el portal de autofacturación
   * pueda cargar el tema Whitelabel del tenant por su empresaId.
   * Solo devuelve la configuración de empresas activas.
   */
  @Get('whitelabel/public/:empresaId')
  @Public()
  async getWhitelabelPublico(@Param('empresaId') empresaId: string) {
    return this.companySettingsService.getWhitelabelPublico(empresaId);
  }
}
