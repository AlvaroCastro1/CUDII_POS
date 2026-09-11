import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

// Fuentes pre-cargadas disponibles para selección por el tenant
const FUENTES_DISPONIBLES = [
  'Geist',
  'Inter',
  'Plus Jakarta Sans',
  'Roboto',
  'DM Sans',
  'Nunito',
  'Poppins',
  'Outfit',
  'Raleway',
  'JetBrains Mono',
] as const;

/**
 * DTO para los colores principales de la identidad visual del tenant.
 * Todos los campos son hexadecimales válidos (#RRGGBB).
 */
export class ColoresWhitelabelDto {
  @IsOptional()
  @IsHexColor()
  colorPrincipal?: string;

  @IsOptional()
  @IsHexColor()
  colorSecundario?: string;

  @IsOptional()
  @IsHexColor()
  colorBoton?: string;

  @IsOptional()
  @IsHexColor()
  colorBotonTexto?: string;

  @IsOptional()
  @IsHexColor()
  colorFondoClaro?: string;

  @IsOptional()
  @IsHexColor()
  colorFondoOscuro?: string;

  @IsOptional()
  @IsHexColor()
  colorSuperficieClaro?: string;

  @IsOptional()
  @IsHexColor()
  colorSuperficieOscuro?: string;

  @IsOptional()
  @IsHexColor()
  colorTextoClaro?: string;

  @IsOptional()
  @IsHexColor()
  colorTextoOscuro?: string;
}

/**
 * DTO para la identidad de marca del tenant.
 * URLs de logos validadas (rutas internas /uploads/ o URLs externas válidas).
 */
export class MarcaWhitelabelDto {
  @IsOptional()
  @IsString()
  nombreNegocio?: string;

  @IsOptional()
  @IsString()
  eslogan?: string;

  /** URL del logo principal (modo claro). Puede ser ruta interna /uploads/logos/... */
  @IsOptional()
  @IsString()
  logoPrincipalUrl?: string | null;

  /** URL del logo para modo oscuro. Si es null, se usa el logo principal. */
  @IsOptional()
  @IsString()
  logoModoOscuroUrl?: string | null;

  /** URL del favicon. Si es null, se usa el favicon por defecto de CUDII. */
  @IsOptional()
  @IsString()
  faviconUrl?: string | null;
}

/**
 * DTO para la tipografía del tenant.
 * Solo se permiten fuentes de la lista pre-cargada en el bundle de la app.
 */
export class TypografiaWhitelabelDto {
  @IsOptional()
  @IsIn(FUENTES_DISPONIBLES)
  fuenteTitulos?: string;

  @IsOptional()
  @IsIn(FUENTES_DISPONIBLES)
  fuenteContenido?: string;
}

/**
 * DTO para el comportamiento de la interfaz del tenant.
 */
export class InterfazWhitelabelDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  modoPredeterminado?: 'light' | 'dark' | 'system';

  @IsOptional()
  @IsBoolean()
  animacionesHabilitadas?: boolean;

  @IsOptional()
  @IsIn(['sidebar', 'topbar'])
  estiloNavegacion?: 'sidebar' | 'topbar';
}

/**
 * DTO raíz para actualizar la configuración Whitelabel completa.
 * Todos los bloques son opcionales (solo se actualizan los que vienen informados).
 */
export class ConfiguracionWhitelabelDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MarcaWhitelabelDto)
  marca?: MarcaWhitelabelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ColoresWhitelabelDto)
  colores?: ColoresWhitelabelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TypografiaWhitelabelDto)
  tipografia?: TypografiaWhitelabelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InterfazWhitelabelDto)
  interfaz?: InterfazWhitelabelDto;
}
