import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '@prisma/client';

export class ItemDetalleVentaDto {
  @IsUUID()
  productoId: string;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @IsOptional()
  @IsString()
  unidadMedida?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;
}

export class ItemPagoVentaDto {
  @IsEnum(MetodoPago)
  metodo: MetodoPago;

  @IsNumber()
  @Min(0)
  montoRecibido: number;

  @IsNumber()
  @Min(0)
  montoPagado: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cambio?: number;

  @IsOptional()
  @IsString()
  referencia?: string;
}

export class CrearVentaDto {
  @IsUUID()
  sesionCajaId: string;

  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @IsOptional()
  @IsUUID()
  cajaId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDetalleVentaDto)
  detalles: ItemDetalleVentaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPagoVentaDto)
  pagos: ItemPagoVentaDto[];

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoGeneral?: number;

  /**
   * D10: Puntos de lealtad a canjear en esta venta.
   * Solo aplica si el programa está habilitado con canje activo y
   * el cliente tiene saldo suficiente. Equivale a un descuento adicional.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  puntosACanjear?: number;

  /**
   * Cupón de descuento a aplicar en esta venta.
   * El monto de descuento se valida y registra de forma atómica
   * dentro de la transacción (CuponRedencion).
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoCupon?: string;
}
