import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * D12: Línea de detalle (producto suelto) de un presupuesto.
 * El precio lo decide siempre el servidor (precio actual o congelado).
 */
export class ItemPresupuestoDetalleDto {
  @IsUUID()
  productoId: string;

  @IsNumber()
  @Min(0)
  cantidad: number;

  @IsOptional()
  @IsString()
  unidadMedida?: string;
}

/**
 * D12: Combo a incluir en el presupuesto.
 * El servidor lo expande con precios autoritativos de BD (nunca del cliente).
 */
export class ItemPresupuestoComboDto {
  @IsUUID()
  comboId: string;

  @IsNumber()
  @Min(1)
  cantidad: number;
}

/**
 * D12: Cuerpo para crear un presupuesto (cotización).
 * NO requiere sesión de caja, NO toca inventario ni consume cupón/puntos:
 * se toma un snapshot congelado del desglose y contexto del carrito.
 */
export class CrearPresupuestoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPresupuestoDetalleDto)
  detalles: ItemPresupuestoDetalleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPresupuestoComboDto)
  combos?: ItemPresupuestoComboDto[];

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  /** Descuento general (en $) que el cajero aplica al ticket. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoGeneral?: number;

  /** Código del cupón a aplicar (se valida pero NO se redime al crear). */
  @IsOptional()
  @IsString()
  codigoCupon?: string;

  /** Puntos que el cliente piensa canjear (se validan pero NO se consumen al crear). */
  @IsOptional()
  @IsInt()
  @Min(0)
  puntosACanjear?: number;
}
