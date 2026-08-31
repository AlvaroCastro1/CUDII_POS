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

  /**
   * D12: Marco del combo al que pertenece esta línea (snapshot del nombre),
   * utilizado cuando el POS envía líneas ya expandidas desde un presupuesto.
   */
  @IsOptional()
  @IsUUID()
  comboId?: string;

  @IsOptional()
  @IsString()
  nombreCombo?: string;
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

/**
 * D11: Combo/paquete vendido. El servidor lo expande en líneas de DetalleVenta
 * con precios autoritativos tomados de la BD (nunca del cliente).
 */
export class ItemComboVentaDto {
  @IsUUID()
  comboId: string;

  @IsNumber()
  @Min(1)
  cantidad: number;
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
  @ValidateNested({ each: true })
  @Type(() => ItemDetalleVentaDto)
  detalles: ItemDetalleVentaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPagoVentaDto)
  pagos: ItemPagoVentaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemComboVentaDto)
  combos?: ItemComboVentaDto[];

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

  /**
   * D12: Si viene, esta venta se origina a partir de un presupuesto. El backend
   * decide si conservar el precio congelado del presupuesto (según la config
   * `Empresa.conservarPrecioPresupuesto`) o recalcular los precios actuales,
   * y marca el presupuesto como `vendido` en la misma transacción.
   */
  @IsOptional()
  @IsUUID()
  presupuestoId?: string;
}
