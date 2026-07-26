# CUDII - Reglas de Negocio y Contratos Comerciales (REGLAS_NEGOCIO)

Este documento define TODAS las reglas de negocio, validaciones comerciales, flujos de venta, inventario, promociones, precios y políticas que el sistema **CUDII** debe enforce estrictamente. Ningún código de negocio puede violar estas reglas, las cuales complementan la especificación técnica en [SPEC.md](/CUDII_POS/.agents/SPEC.md). 

*Nota importante: Los fragmentos de código, interfaces y estructuras de datos descritos en este documento son exclusivamente de carácter referencial y explicativo para ilustrar las reglas y estructura de datos. La implementación final dependerá del ORM (Prisma) y el stack.*

---

## 1. Modelo de Productos y Variantes

### 1.1 Estructura del Producto

```typescript
interface Producto {
  uuid: string;
  empresaId: string;
  sucursalIds: string[]; // Sucursales donde está disponible
  codigoBarras: string;
  codigoInterno: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  marcaId?: string;
  proveedorPrincipalId?: string;
  imagenUrl?: string;
  unidadMedida: UnidadMedida;
  estaActivo: boolean; // true = activo, false = desactivado (Soft Delete)
  desactivadoEn?: string; // ISO 8601, null si está activo
  desactivadoPorId?: string; // Usuario que lo desactivó
  esGranel: boolean; // true = se vende por peso
  requiereLote: boolean; // true = control por lote y caducidad
  manejaInventario: boolean; // false = stock ilimitado (servicios, digitales)
  precioCompra: number;
  precioVentaBase: number;
  impuestos: Impuesto[];
  preciosPorUnidad: PrecioPorUnidad[];
  modificadores: Modificador[]; // OPCIONAL: ingredientes, personalizaciones
  creadoEn: string; // ISO 8601
  actualizadoEn: string;
}
```

### 1.2 Unidades de Venta Configurables por Negocio

Cada negocio define qué unidades de venta soporta. CUDII se adapta al giro del comercio y provee múltiples unidades, permitiendo que un mismo producto se venda en diferentes presentaciones (por ejemplo: por pieza, por caja o por pallet):

| Unidad | Ejemplo | Configurable por |
|---|---|---|
| **Unidad (pieza)** | 1 playera, 1 lata de refresco | Todo negocio |
| **Peso (granel)** | 1.250 kg de tomate, 500g de jamón | Tiendas de abarrotes, carnicerías |
| **Caja/Cajas** | 1 caja de 24 latas de refresco | Mayoreo, distribuidores, abarrotes |
| **Paquete** | 6 piezas en pack (Six-pack) | Promociones, combos, minisúper |
| **Litro/Metro** | 1 litro de aceite, 2m de tela | Papelerías, ferreterías |
| **Docena** | 1 docena de rosas, docena de huevos | Florerías, mercados |
| **Costal/Bulto** | 1 costal de azúcar (50kg), bulto de cemento | Abarrotes, ferreterías, materiales |
| **Pallet/Tarima** | 1 pallet de papel higiénico | Mayoristas, bodegas |
| **Servicio** | 1 corte de pelo, 1 reparación | Salones, talleres |

**Ejemplo de Producto Multimedida:** 
Un mismo producto (ej. "Refresco de Cola") puede tener asociadas varias unidades de medida a través de sus `preciosPorUnidad`. Si el cajero escanea el código de barras principal, el sistema puede preguntar si está vendiendo 1 Pieza ($15), 1 Paquete de 6 ($85) o 1 Caja de 24 ($320), descontando la cantidad correspondiente del stock base de piezas (o stockeando por cajas directamente según configuración).

**Regla de negocio:**
- El administrador selecciona las unidades habilitadas en **Configuración > Unidades de Venta**.
- Cada producto puede tener múltiples `preciosPorUnidad` con precio diferenciado.
- Al agregar un producto al carrito, el sistema muestra las unidades disponibles para ese producto.

### 1.3 Precios por Unidad y Escala (Mayoreo / Minorista)

```typescript
interface PrecioPorUnidad {
  uuid: string;
  productoId: string;
  unidad: 'pieza' | 'kilogramo' | 'gramo' | 'litro' | 'caja' | 'paquete' | 'metro';
  nombreAlternativo?: string; // ej: "Media caja", "Paquete de 6"
  cantidadMinima: number; // Cantidad mínima para aplicar este precio
  cantidadMaxima?: number; // null = sin límite superior
  precio: number;
  esDefault: boolean;
}
```

**Reglas de precios escalonados:**
1. **_MINORISTA (Default):** 1 pieza a precio base.
2. **MAYOREO:** Aplica automático al superar `cantidadMinima` (ej: ≥12 piezas).
3. **CAJA COMPLETA:** Precio especial al comprar caja cerrada (ej: 24 piezas).
4. **GRANEL:** Precio por kilogramo/gramo calculado en tiempo real desde báscula.

**Algoritmo de selección de precio:**
```
1. Obtener todas las PrecioPorUnidad del producto habilitadas para la sucursal.
2. Filtrar por unidad seleccionada por el cajero.
3. Dentro de la misma unidad, buscar el rango donde cantidadMinima <= cantidad <= cantidadMaxima.
4. Si hay múltiples rangos, aplicar el de mayor cantidadMinima que cumpla.
5. Si no hay precio especial, usar precioVentaBase * cantidad.
```

### 1.4 Producto Granel (Venta por Peso)

- El precio se calcula en tiempo real: `pesoKg * precioPorKilo`.
- La báscula envía el peso cada 200ms via WebSocket al carrito (ver [PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md#2-integracion-de-basculas-digitales-rs232--usb--serie)).
- El cajero puede capturar peso manualmente si la báscula no está conectada.
- Redondeo: 2 decimales para kg, 0 decimales para gramos.

---

## 2. Flujo de Venta (Caja POS)

### 2.1 Estados del Carrito de Compras

```typescript
type EstadoCarrito = 
  | 'en_curso'        // Artículos agregándose
  | 'en_pago'         // Cajero seleccionó método de pago
  | 'procesando'      // Validando stock, procesando pago
  | 'completada'      // Venta liquidada exitosamente
  | 'cancelada';      // Venta cancelada antes de completar
```

### 2.2 Flujo Completo de Venta

```text
[1] Agregar productos al carrito
    │
    ├──► Validar stock disponible (si manejaInventario = true)
    ├──► Calcular precio según unidad y escala
    ├──► Aplicar promociones/cupones vigentes
    ├──► Calcular impuestos (IVA 16% o exento)
    │
[2] Seleccionar cliente (opcional)
    │
    ├──► Si tiene RFC → facturar CFDI 4.0
    ├──► Si no tiene → venta al "Público General"
    │
[3] Seleccionar método de pago
    │
    ├──► Efectivo → solicitar monto recibido, calcular cambio
    ├──► Tarjeta → integración con pasarela (Kushki/Mercado Pago)
    ├──► Mixto → dividir entre efectivo y tarjeta
    ├──► Voucher/Nota de crédito → aplicar saldo
    │
[4] Confirmar cobro
    │
    ├──► Descontar stock (inventario decrementado)
    ├──► Enviar venta al Backend (API REST)
    ├──► Generar UUID de idempotencia
    ├──► Imprimir ticket (si hay impresora conectada, ver [PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md#3-impresoras-termicas-de-tickets-y-plantillas-editables))
    ├──► Abrir cajón de dinero (si es efectivo y está habilitado, ver [PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md#4-control-del-cajon-de-dinero))
    │
[5] Fin
    ├──► Toast de éxito
    ├──► Reiniciar carrito
```

### 2.3 Métodos de Pago Soportados

| Método | Implementación | Requiere Integración |
|---|---|---|
| **Efectivo** | nativo | No |
| **Tarjeta de débito** | Pasarela de pago | Sí (Kushki, Mercado Pago, etc.) |
| **Tarjeta de crédito** | Pasarela de pago | Sí |
| **Transferencia SPEI** | Pasarela de pago | Sí |
| **Voucher / Nota de crédito** | nativo | No |
| **Cupón de descuento** | motor de promociones | No |
| **Pago mixto** | Combina dos métodos | Parcial |

**Reglas de pago:**
- El efectivo NO puede exceder el monto de la venta (sistema valida).
- El cambio se calcula automáticamente: `montoRecibido - totalVenta`.
- Si el pago es con tarjeta y falla, la venta vuelve a estado `en_pago`.
- Los vouchers de crédito tienen fecha de expiración configurable.
- El pago mixto permite dividir entre exactamente 2 métodos.

### 2.4 Cancelación de Venta

- **Solo se puede cancelar una venta completada si:**
  1. No ha sido facturada (CFDI 4.0 no timbrado).
  2. Han pasado menos de `X` horas desde la venta (configurable por negocio, default: 24h).
  3. El usuario tiene permiso `VENTA_CANCELAR`.
- **Al cancelar:**
  1. El stock se reincorpora automáticamente.
  2. Si fue pago con tarjeta, se marca como "reversión pendiente".
  3. Se genera registro de auditoría con motivo obligatorio.
  4. Se imprime "NOTA DE CANCELACIÓN" si hay impresora.

### 2.5 Devoluciones

```typescript
interface Devolucion {
  uuid: string;
  ventaOriginalId: string;
  empresaId: string;
  sucursalId: string;
  usuarioId: string;
  motivo: string; // Obligatorio
  productos: ProductoDevolucion[];
  metodoReembolso: 'efectivo' | 'voucher' | 'mismo_metodo';
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  creadoEn: string;
}
```

**Reglas de devolución:**
1. Solo se puede devolver sobre ventas completadas (no canceladas).
2. Cada producto devuelto debe tener cantidad <= cantidad comprada originalmente.
3. El stock se reincorpora al inventario solo al aprobar la devolución.
4. Requiere aprobación de supervisor (rol `SUPERVISOR` o `ADMIN`).
5. Se genera nota de crédito si el cliente la solicita.

---

## 3. Inventario y Stock

### 3.1 Modelo de Inventario

```typescript
interface InventarioSucursal {
  uuid: string;
  sucursalId: string;
  productoId: string;
  stockActual: number;
  stockMinimo: number; // Alerta de stock bajo
  stockMaximo: number; // Sugerencia de reorden
  ubicacionPasillo?: string;
  ubicacionEstante?: string;
  ultimoIngreso: string;
  ultimoMovimiento: string;
}

interface MovimientoInventario {
  uuid: string;
  productoId: string;
  sucursalId: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  referencia: string; // ID de venta, traspaso, ajuste, etc.
  motivo?: string;
  usuarioId: string;
  fechaHora: string;
}

type TipoMovimientoInventario = 
  | 'venta'              // Décremento por venta
  | 'devolucion_venta'   // Incremento por devolución
  | 'ajuste_positivo'    // Conteo físico mayor
  | 'ajuste_negativo'    // Conteo físico menor / merma
  | 'traspaso_salida'    // Enviado a otra sucursal
  | 'traspaso_entrada'   // Recibido de otra sucursal
  | 'compra'             // Ingreso por compra a proveedor
  | 'apertura_inicial';  // Stock al abrir caja/sistema
```

### 3.2 Reglas de Stock

1. **Stock negativo PROHIBIDO por defecto:** Si `manejaInventario = true`, el sistema no permite vender más del stock disponible.
2. (Reservado para validación de concurrencia en transacciones)
3. **Alerta de stock bajo:** Cuando `stockActual <= stockMinimo`, el sistema emite notificación al dashboard y al admin.
4. **Bloqueo por stock 0:** El producto aparece como "Agotado" en la caja y no se puede agregar al carrito (excepto si `manejaInventario = false`).
5. **Merma y pérdidas:** Se registran como `ajuste_negativo` con motivo obligatorio y aprobación de supervisor.

### 3.3 Lotes y Caducidad (Multisucursal)

```typescript
interface Lote {
  uuid: string;
  productoId: string;
  sucursalId: string;
  numeroLote: string;
  fechaCaducidad: string; // ISO 8601
  cantidadInicial: number;
  cantidadActual: number;
  proveedorId: string;
  precioCompraLote: number;
  creadoEn: string;
}
```

**Reglas de lotes:**
1. Si el producto tiene `requiereLote = true`, toda entrada de stock debe asociarse a un lote.
2. **FIFO estricto:** Se vende primero el lote con fecha de caducidad más próxima.
3. **Alerta de caducidad:** 30 días antes de vencer, el sistema notifica.
4. **Bloqueo por caducidad:** Productos vencidos NO aparecen en la caja.
5. **Descuento por proximidad a caducidad:** Configurable (ej: 30% OFF a 7 días de vencer).

### 3.4 Traspasos entre Sucursales

```typescript
interface Traspaso {
  uuid: string;
  sucursalOrigenId: string;
  sucursalDestinoId: string;
  estado: 'solicitado' | 'en_transito' | 'recibido' | 'cancelado';
  productos: TraspasoProducto[];
  solicitadoPor: string;
  recibidoPor?: string;
  fechaSolicitud: string;
  fechaRecepcion?: string;
  observaciones?: string;
}
```

**Reglas de traspaso:**
1. Solo el rol `ADMIN` o `GERENTE` puede solicitar traspasos.
2. El stock se decrementa en origen al confirmar envío.
3. El stock se incrementa en destino al confirmar recepción.
4. Si hay discrepancia entre enviado y recibido, se marca como `discrepancia`.
5. Cada traspaso genera 2 movimientos de inventario (salida + entrada).

---

## 4. Promociones, Cupones y Paquetes

### 4.1 Tipos de Promociones

```typescript
type TipoPromocion = 
  | 'descuento_porcentaje'  // 20% OFF en categoría X
  | 'descuento_monto_fijo'  // $50 OFF en producto Y
  | '2x1'                   // Compra 2, paga 1
  | '3x2'                   // Compra 3, paga 2
  | 'n_x_m'                 // Compra N, paga M
  | 'precio_fijo'           // Producto a precio especial
  | 'bundle'                // Paquete (ej: refresco + papas = $89)
  | 'envio_gratis'          // Envío gratis por compra mínima
  | 'cashback'              // Devolver $X en crédito para próxima compra
  | 'acumulacion_puntos';   // Acumular puntos por compra

interface Promocion {
  uuid: string;
  empresaId: string;
  sucursalIds: string[]; // Vacío = aplica a todas
  tipo: TipoPromocion;
  nombre: string;
  descripcion: string;
  condiciones: CondicionPromocion;
  accion: AccionPromocion;
  fechaInicio: string;
  fechaFin: string;
  horaInicio?: string; // ej: Happy Hour 14:00-18:00
  horaFin?: string;
  diasSemana?: number[]; // [0=Dom, 1=Lun, ..., 6=Sab]
  limiteUsosTotal?: number;
  limiteUsosPorCliente?: number;
  esAcumulable: boolean; // Combinable con otras promos
  estado: 'activa' | 'pausada' | 'programada' | 'finalizada';
  creadoPor: string;
  creadoEn: string;
}
```

### 4.2 Condiciones de Promociones

```typescript
interface CondicionPromocion {
  // Compra mínima
  montoMinimoCompra?: number;
  cantidadMinimaProductos?: number;
  
  // Filtros de productos aplicables
  productoIds?: string[];       // Productos específicos
  categoriaIds?: string[];      // Categorías completas
  marcaIds?: string[];          // Marcas específicas
  excluidoProductoIds?: string[]; // Exclusiones
  
  // Para clientes
  soloClientesRegistrados?: boolean;
  clienteTierMinimo?: 'bronce' | 'plata' | 'oro' | 'platino';
  
  // Para combo/bundle
  productosRequeridos?: { productoId: string; cantidad: number }[];
  
  // Para cupón
  codigoCupon?: string;         // Código alfanumérico único
  esCuponUnicoUso?: boolean;    // Un uso por cliente
}
```

### 4.3 Motor de Descuentos (Cascada de Prioridad)

Cuando múltiples promociones aplican al mismo producto/carrito:

```text
1. Promociones de producto específico (mayor prioridad)
2. Promociones de categoría
3. Promociones de marca
4. Promociones globales (todas las compras)
5. Cupones de descuento (código)
6. Puntos de lealtad
```

**Reglas del motor:**
- Si `esAcumulable = false`, solo aplica la promoción de MAYOR descuento.
- Si `esAcumulable = true`, se aplica en cascada pero el descuento total no puede exceder el 100% del subtotal.
- Los cupones tienen validación de: vigencia, uso mínimo, uso máximo, y código válido.

### 4.4 Paquetes / Bundles

```typescript
interface Paquete {
  uuid: string;
  empresaId: string;
  nombre: string;
  descripcion: string;
  productos: PaqueteItem[];
  precioPaquete: number;     // Precio fijo del paquete
  precioSinPaquete: number;  // Suma de precios individuales (para mostrar ahorro)
  imagenUrl?: string;
  esActivo: boolean;
  fechaInicio?: string;
  fechaFin?: string;
}

interface PaqueteItem {
  productoId: string;
  cantidad: number;
  esObligatorio: boolean; // true = siempre incluido, false = el cliente puede quitar
}
```

**Reglas de paquetes:**
1. El ahorro se muestra al cliente: "Ahorras $XX.XX" = `precioSinPaquete - precioPaquete`.
2. Si un producto del paquete tiene stock 0, se advierte y notifica pero NO se bloquea la venta (se vende sin ese ítem con ajuste de precio).
3. Los paquetes NO son acumulables con otros descuentos por defecto.

### 4.5 Sugerencias de IA para Promociones

El módulo `CUDII-AI` (ver [PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md#fase-4-inteligencia-artificial-y-automatizacion)) analiza:
1. **Productos más vendidos juntos** (reglas de asociación - Apriori).
2. **Productos con stock alto** que podrían necesitar promoción.
3. **Margen de ganancia** para sugerir descuentos rentables.
4. **Competencia de precios** (si hay datos disponibles).

**Flujo de sugerencia:**
```
IA analiza datos → Genera propuesta → Admin revisa → Admin aprueba → Promoción activa
```

---

## 5. Personalización de Tickets

### 5.1 Estructura Configurable del Ticket

```typescript
interface ConfiguracionTicket {
  empresaId: string;
  sucursalId: string;
  anchoPapel: '58mm' | '80mm';
  
  // Secciones habilitadas (orden de impresión)
  secciones: SeccionTicket[];
  
  // Contenido del encabezado
  encabezado: {
    mostrarLogo: boolean;
    logoUrl?: string;
    nombreNegocio: boolean; // Usar de Whitelabel
    rfc: string;
    direccionSucursal: boolean; // Usar de sucursal
    eslogan: boolean; // Usar de Whitelabel
    telefono?: string;
  };
  
  // Contenido del pie
  pie: {
    mensajePersonalizado?: string; // "¡Gracias por su compra!"
    mostrarCodigoQR: boolean; // QR de autofacturación CFDI
    mostrarFechaHora: boolean;
    mostrarCajero: boolean;
    mostrarNumeroTicket: boolean;
    mostrarUrlWeb?: string;
    mostrarRedesSociales?: boolean;
  };
  
  // Estilo
  estilo: {
    densidadImpresion: 'normal' | 'condensada' | 'densa';
    imprimirNegrita: boolean;
    separadorLinea: 'simple' | 'doble' | 'guiones' | 'ninguno';
  };
}

interface SeccionTicket {
  id: string;
  tipo: 'productos' | 'totales' | 'impuestos' | 'descuentos' | 'pago' | 'cambio' | 'custom';
  titulo?: string;
  mostrar: boolean;
  orden: number;
  contenidoCustom?: string; // Texto libre para sección custom
}
```

### 5.2 Plantillas de Ticket Predefinidas

| Plantilla | Descripción | Ideal para |
|---|---|---|
| **Clásico** | Encabezado + productos + total + pie | Tiendas generales |
| **Mínimo** | Solo productos + total | Comercios rápidos |
| **Detallado** | Con impuestos, descuentos, datos fiscales | Tiendas con facturación |
| **Restaurante** | Con mesero, mesa, propina | Restaurantes (V2.0) |

---

## 6. Cortes de Caja (Apertura / Corte X / Corte Z)

### 6.1 Flujo de Caja

```text
[1] APERTURA DE CAJA
    │
    ├──► Seleccionar cajero (usuario con rol CAJERO)
    ├──► Ingresar fondo inicial (efectivo en caja)
    ├──► Registrar método de apertura (monto exacto / estimado)
    ├──► Abrir cajón de dinero (opcional)
    ├──► Imprimir ticket de apertura
    │
[2] OPERACIÓN DURANTE EL TURNO
    │
    ├──► Todas las ventas se registran con la sesión de caja activa
    ├──► Retiros parciales permitidos (con justificación y autorización)
    ├──► Ingresos extraordinarios (aro de caja, préstamo, etc.)
    │
[3] CORTE X (Parcial / Turno)
    │
    ├──► Modo Ciego o Abierto (configurable)
    ├──► Mostrar resumen: ventas por método, retiros, total esperado
    ├──► Cajero ingresa efectivo contado
    ├──► Sistema calcula diferencia
    ├──► Imprimir ticket de Corte X
    │
[4] CORTE Z (Cierre del Día)
    │
    ├──► Solo disponible una vez por día
    ├──► Cierra la sesión de caja
    ├──► Genera reporte consolidado del día
    ├──► Bloquea ventas retroactivas
    ├──► Envía datos al backend para reportes
    ├──► Imprimir ticket de Corte Z
```

### 6.2 Modelo de Sesión de Caja

```typescript
interface SesionCaja {
  uuid: string;
  empresaId: string;
  sucursalId: string;
  cajaId: string;
  cajeroId: string;
  fondoInicial: number;
  estado: 'abierta' | 'corte_x_realizado' | 'cerrada';
  fechaApertura: string;
  fechaCierre?: string;
  
  // Resumen del turno
  totalVentasEfectivo: number;
  totalVentasTarjeta: number;
  totalVentasOtro: number;
  totalVentasGeneral: number;
  totalRetiros: number;
  totalIngresosExtra: number;
  efectivoEsperado: number; // fondoInicial + ventasEfectivo - retiros + ingresosExtra
  efectivoContado?: number; // Lo que el cajero cuenta
  diferencia?: number; // efectivoContado - efectivoEsperado
  
  // Auditoría
  cortesX: CorteX[];
  corteZ?: CorteZ;
}

interface CorteX {
  uuid: string;
  sesionCajaId: string;
  fechaHora: string;
  tipo: 'ciego' | 'abierto';
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  ventasPorMetodo: { metodo: string; total: number; cantidad: number }[];
  retiros: RetiroParcial[];
  usuarioId: string;
}

interface CorteZ {
  uuid: string;
  sesionCajaId: string;
  fechaHora: string;
  resumenDelDia: ResumenDiario;
  usuarioId: string;
}
```

### 6.3 Modos de Corte

- **Corte Ciego:** El cajero cuenta el efectivo SIN ver lo que el sistema espera. El sistema calcula la diferencia internamente y la reporta al administrador. *Propósito: detectar sobornos o inconsistencias.*
- **Corte Abierto:** El sistema muestra el saldo esperado en pantalla para que el cajero cuadre en tiempo real.

---

## 7. Clientes y Programa de Lealtad

### 7.1 Modelo de Cliente

```typescript
interface Cliente {
  uuid: string;
  empresaId: string;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  rfc?: string;
  email?: string;
  telefono?: string;
  direccion?: Direccion;
  fechaNacimiento?: string;
  genero?: 'masculino' | 'femenino' | 'otro' | 'no_especificado';
  
  // Facturación
  usoCfdi: string; // 'G03' (Gastos en general), 'D01' (Médicos), etc.
  regimenFiscal?: string;
  
  // Estado y Desactivación
  estaActivo: boolean; // true = activo, false = desactivado (Soft Delete)
  desactivadoEn?: string; // ISO 8601, null si está activo
  desactivadoPorId?: string; // Usuario que lo desactivó
  
  // Lealtad
  puntosActuales: number;
  puntosHistoricos: number;
  tier: 'sin_tier' | 'bronce' | 'plata' | 'oro' | 'platino';
  fechaRegistro: string;
  
  // Estadísticas (calculadas)
  totalCompras: number;
  montoTotalComprado: number;
  ultimaCompra?: string;
  frecuenciaCompra: 'nuevo' | 'ocasional' | 'regular' | 'frecuente' | 'vip';
}
```

### 7.2 Programa de Puntos y Lealtad

```typescript
interface ConfiguracionLealtad {
  empresaId: string;
  puntosPorPesoGastado: number; // ej: 1 punto por $10 gastados
  valorPuntoEnPesos: number;    // ej: 1 punto = $0.50
  puntosExpiranDias?: number;   //ej: 365 días
  tiers: TierConfig[];
}

interface TierConfig {
  nombre: 'bronce' | 'plata' | 'oro' | 'platino';
  puntosMinimos: number;
  descuentoPorcentaje: number; // Descuento automático por tier
  beneficios: string[];
}
```

**Reglas de puntos:**
1. Los puntos se acumulan al completar una venta (no al iniciar).
2. Los puntos NO se acumulan en ventas canceladas.
3. Los puntos se canjean como método de pago parcial o total.
4. Un punto expirado se descuenta automáticamente del saldo.
5. El tier se recalcula semanalmente según acumulado.

---

## 8. Notificaciones

### 8.1 Canales de Notificación

```typescript
type CanalNotificacion = 'telegram' | 'whatsapp' | 'email' | 'push' | 'sms' ;

interface ConfiguracionNotificacion {
  empresaId: string;
  canal: CanalNotificacion;
  estaActivo: boolean;
  configuracion: Record<string, unknown>; // Token, API key, etc.
  eventos: EventoNotificacion[];
}

type EventoNotificacion = 
  | 'venta_completada'
  | 'venta_cancelada'
  | 'stock_bajo'
  | 'stock_agotado'
  | 'producto_caducado'
  | 'caja_abierta'
  | 'caja_cerrada'
  | 'corte_x_realizado'
  | 'corte_z_realizado'
  | 'discrepancia_inventario'
  | 'nuevo_cliente_registrado'
  | 'promocion_proxima_expirar'
  | 'sistema_actualizacion_disponible'
  | 'alerta_seguridad_login'
  | 'alerta_descuento_grande'; // descuento > 50%
```

### 8.2 Configuración por Evento

```typescript
interface PlantillaNotificacion {
  evento: EventoNotificacion;
  canal: CanalNotificacion;
  asunto: string; // Para email
  mensaje: string; // Con variables: {{producto}}, {{cantidad}}, {{monto}}, etc.
  incluirDetalles: boolean;
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';
}
```

### 8.3 Integraciones

| Canal | Proveedor Recomendado | Prioridad |
|---|---|---|
| **Telegram** | Bot API (gratis) | Alta |
| **WhatsApp** | WhatsApp Business API (Meta) | Alta |
| **Email** | SendGrid / Mailgun | Media |
| **Push** | Firebase Cloud Messaging (FCM) | Media |
| **SMS** | Twilio | Baja |

---

## 9. Reportes

### 9.1 Reportes Core (V1.0)

| Reporte | Período | Métricas |
|---|---|---|
| **Ventas del Día** | Diario | Total, por método, por hora, ticket promedio |
| **Ventas por Producto** | Diario/Semanal/Mensual | Unidades, ingreso, margen |
| **Ventas por Categoría** | Semanal/Mensual | Ranking, tendencia |
| **Inventario** | Tiempo real | Stock, alertas, rotación |
| **Productos Más Vendidos** | Semanal/Mensual | Top 10, velocity |
| **Clientes** | Mensual | Frecuencia, ticket promedio, recencia |
| **Caja y Cortes** | Diario | Arqueo, diferencias, retiros |
| **Cupones y Promociones** | Mensual | Usos, descuentos otorgados, ROI |
| **Margen de Ganancia** | Mensual | Por producto, categoría, marca |

### 9.2 Reportes Avanzados (V2.0 con IA)

| Reporte | Descripción |
|---|---|
| **Predicción de Stock** | IA predice cuándo se agotará cada producto |
| **Análisis de Compra** | Sugerencias de compra basadas en tendencia |
| **Detección de Anomalías** | Ventas inusuales, descuentos sospechosos |
| **Comparativa sucursales** | Benchmark entre ubicaciones |
| **Lenguaje Natural** | "¿Cuánto vendí de Coca-Cola la semana pasada?" |

### 9.3 Formato de Exportación

- **Pantalla:** Dashboard interactivo con gráficas.
- **PDF:** Reporte descargable con logo y formato profesional.
- **Excel/CSV:** Para análisis externo o contabilidad.
- **Email:** Envío automático programado (diario/semanal).

---

## 10. Seguridad y RBAC (Roles y Permisos)

### 10.1 Roles por Defecto

| Rol | Descripción | Permisos Principales |
|---|---|---|
| **SUPER_ADMIN** | Dueño de la plataforma CUDII | Todo + gestión de empresas |
| **ADMIN** | Dueño/gerente de la empresa | Todo dentro de su empresa |
| **GERENTE** | Gerente de sucursal | Ventas, reportes, inventario, traspasos de su empresa |
| **CAJERO** | Operador de caja | Ventas, cobros, corte X de su empresa |
| **ALMACEN** | Encargado de inventario | Stock, lotes, traspasos recibidos de su empresa |
| **CONTADOR** | Acceso a reportes fiscales | Reportes, facturación, cortes de su empresa |

### 10.2 Permisos Granulares

```typescript
interface Permiso {
  id: string;
  categoria: string;
  descripcion: string;
}

// Permisos disponibles
const PERMISOS: Permiso[] = [
  // Ventas
  { id: 'VENTA_CREAR', categoria: 'Ventas', descripcion: 'Crear nuevas ventas' },
  { id: 'VENTA_CANCELAR', categoria: 'Ventas', descripcion: 'Cancelar ventas completadas' },
  { id: 'VENTA_DESCUENTO', categoria: 'Ventas', descripcion: 'Aplicar descuentos manuales' },
  { id: 'VENTA_DEVOLUCION', categoria: 'Ventas', descripcion: 'Procesar devoluciones' },
  
  // Inventario
  { id: 'INVENTARIO_VER', categoria: 'Inventario', descripcion: 'Consultar stock' },
  { id: 'INVENTARIO_EDITAR', categoria: 'Inventario', descripcion: 'Ajustar stock manualmente' },
  { id: 'INVENTARIO_TRASPASO', categoria: 'Inventario', descripcion: 'Crear/recibir traspasos' },
  
  // Caja
  { id: 'CAJA_ABRIR', categoria: 'Caja', descripcion: 'Abrir sesión de caja' },
  { id: 'CAJA_CERRAR', categoria: 'Caja', descripcion: 'Cerrar sesión de caja' },
  { id: 'CAJA_RETIRO', categoria: 'Caja', descripcion: 'Realizar retiros parciales' },
  { id: 'CAJA_APERTURA_CAJON', categoria: 'Caja', descripcion: 'Abrir cajón sin venta' },
  
  // Reportes
  { id: 'REPORTE_VENTAS', categoria: 'Reportes', descripcion: 'Ver reportes de ventas' },
  { id: 'REPORTE_INVENTARIO', categoria: 'Reportes', descripcion: 'Ver reportes de inventario' },
  { id: 'REPORTE_FINANCIERO', categoria: 'Reportes', descripcion: 'Ver reportes financieros' },
  
  // Administración
  { id: 'ADMIN_USUARIOS', categoria: 'Admin', descripcion: 'Gestionar usuarios' },
  { id: 'ADMIN_SUCURSALES', categoria: 'Admin', descripcion: 'Gestionar sucursales' },
  { id: 'ADMIN_PRODUCTOS', categoria: 'Admin', descripcion: 'Crear/editar productos' },
  { id: 'ADMIN_PROMOCIONES', categoria: 'Admin', descripcion: 'Crear/editar promociones' },
  { id: 'ADMIN_CONFIGURACION', categoria: 'Admin', descripcion: 'Configurar el sistema' },
  
  // Facturación
  { id: 'CFDI_TIMBRAR', categoria: 'Facturación', descripcion: 'Timbrar CFDI 4.0' },
  { id: 'CFDI_CANCELAR', categoria: 'Facturación', descripcion: 'Cancelar CFDIs' },
  
  // Compras y Proveedores
  { id: 'PROVEEDOR_VER', categoria: 'Compras', descripcion: 'Consultar catálogo de proveedores' },
  { id: 'PROVEEDOR_EDITAR', categoria: 'Compras', descripcion: 'Crear/editar proveedores' },
  { id: 'ORDEN_COMPRA_CREAR', categoria: 'Compras', descripcion: 'Crear órdenes de compra' },
  { id: 'ORDEN_COMPRA_APROBAR', categoria: 'Compras', descripcion: 'Aprobar y enviar órdenes de compra' },
  { id: 'ORDEN_COMPRA_RECIBIR', categoria: 'Compras', descripcion: 'Confirmar recepción de mercancía' },
  
  // Crédito y Fiados
  { id: 'CREDITO_VENTA', categoria: 'Crédito', descripcion: 'Autorizar ventas a crédito (fiado)' },
  { id: 'CREDITO_ABONO', categoria: 'Crédito', descripcion: 'Recibir abonos a cuentas de crédito' },
  { id: 'CREDITO_ESTADO_CUENTA', categoria: 'Crédito', descripcion: 'Consultar e imprimir estados de cuenta' },
  { id: 'CREDITO_CONFIGURAR', categoria: 'Crédito', descripcion: 'Definir límites de crédito por cliente' },
  
  // Devoluciones y Garantías
  { id: 'DEVOLUCION_CREAR', categoria: 'Devoluciones', descripcion: 'Iniciar un proceso de devolución' },
  { id: 'DEVOLUCION_APROBAR', categoria: 'Devoluciones', descripcion: 'Aprobar devoluciones de efectivo o montos altos' },
  
  // Migración
  { id: 'MIGRACION_IMPORTAR', categoria: 'Migración', descripcion: 'Importar datos desde archivos externos' },
  { id: 'MIGRACION_APROBAR', categoria: 'Migración', descripcion: 'Aprobar importación masiva de datos' },
  
  // IA Conversacional
  { id: 'IA_CONSULTAR', categoria: 'IA', descripcion: 'Realizar consultas al asistente de IA' },
  { id: 'IA_EJECUTAR_ACCIONES', categoria: 'IA', descripcion: 'Aprobar acciones sugeridas por la IA' },
];
```

### 10.3 Auditoría Obligatoria

Toda acción sensible genera un registro inmutable:

```typescript
interface RegistroAuditoriaDTO {
  uuid: string;
  empresaId: string;
  sucursalId: string;
  usuarioId: string;
  accion: string;
  detalles: Record<string, unknown>;
  direccionIP?: string;
  agenteUsuario?: string;
  fechaHora: string; // ISO 8601
}

/**
 * Representa un cambio en un campo de una entidad core para reportes históricos de comportamiento visual.
 */
interface HistorialCambioEntidad {
  uuid: string;
  empresaId: string;
  sucursalId: string;
  usuarioId: string; // Quién hizo el cambio
  entidadTipo: 'producto' | 'cliente' | 'usuario' | 'sucursal' | 'promocion';
  entidadUuid: string; // UUID de la entidad modificada
  campoModificado: string; // Nombre del campo clave
  valorAnterior: string; // Serializado en string o JSON
  valorNuevo: string; // Serializado en string o JSON
  fechaHora: string; // ISO 8601
  motivo?: string; // Justificación (obligatoria para cambios sensibles como el precio)
}

/**
 * Campos clave a rastrear obligatoriamente en el Historial para optimizar la DB:
 * - Producto: 'precioVentaBase', 'precioCompra', 'estaActivo'
 * - Cliente: 'estaActivo', 'puntosActuales', 'tier'
 * - Usuario: 'estaActivo', 'rol' (cambio de permisos/rol)
 * - Sucursal: 'estaActivo'
 * - Promoción: 'estaActivo', 'estado'
 */
```

**Acciones que generan auditoría:**
- Login / Logout
- Venta completada / cancelada
- Descuento aplicado (con monto y justificación)
- Apertura de cajón sin venta
- Retiro de caja
- Cambio de precio manual
- Ajuste de inventario
- Creación / edición / eliminación de producto
- Cambio de rol o permisos
- Facturación / cancelación de CFDI

---

## 11. Reglas Fiscales (CFDI 4.0 México)

### 11.1 Datos Requeridos para Facturación

| Campo | Requerido | Descripción |
|---|---|---|
| RFC del receptor | Sí | 12 o 13 caracteres |
| Régimen fiscal del receptor | Sí | Catálogo SAT |
| Uso del CFDI | Sí | Ej: G03, D01, I01 |
| Código postal | Sí | Del receptor |
| Método de pago | Sí | PUE (pago en una exibición) o PPD (pago en parcialidades) |
| Forma de pago | Sí | Efectivo, tarjeta, transferencia, etc. |

### 11.2 Reglas de Facturación

1. **Facturación inmediata:** Desde la caja al cobrar, si el cliente tiene RFC.
2. **Autofacturación:** QR + token en ticket para que el cliente facture después.
3. **Venta Global:** Agrupar ventas del día al RFC genérico `XAXX010101000` (Público General).
4. **Cancelación:** Solo se puede cancelar un CFDI dentro de las primeras 72 horas sin uso.
5. **Notas de crédito:** Para devoluciones, se emite NC que referencia el CFDI original.

---

## 12. Integración con Periféricos (Resumen)

Ver [PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) para detalles completos.

**Regla de negocio:**
- Si hay báscula conectada, el peso se captura automáticamente al producto granel.
- Si la báscula se desconecta, el sistema cambia a modo manual sin mostrar errores.
- El ticket se imprime automáticamente al completar la venta.
- Si la impresora falla, el ticket se guarda digitalmente para reimpresión.
- El cajón de dinero solo se abre con venta de efectivo o autorización de supervisor.

---

## 13. Configuración por Sucursal

Cada sucursal puede tener configuración propia:

```typescript
interface ConfiguracionSucursal {
  sucursalId: string;
  
  // Caja
  fondoInicialDefault: number;
  modoCorte: 'ciego' | 'abierto';
  permitirVentaSinStock: boolean;
  tiempoLimiteCancelacionHoras: number;
  
  // Ticket
  configuracionTicket: ConfiguracionTicket;
  
  // Inventario
  alertaStockBajoAutomatica: boolean;
  diasAlertaCaducidad: number;
  
  // Periféricos
  basculaConectada: boolean;
  impresoraConectada: boolean;
  cajonConectado: boolean;
  lectorBarrasConectado: boolean;
  
  // Notificaciones
  notificacionesActivas: CanalNotificacion[];
  
  // Fiscal
  puntoVentaCertificado?: string; // Ruta al CSD
  passwordCsd?: string;
}

---

## 14. Crédito y Ventas a Cuenta Corriente (Fiados)

El sistema de **fiado** o **crédito informal** es una práctica profundamente arraigada en el comercio local mexicano. CUDII lo digitaliza con trazabilidad completa, límites configurables y alertas automáticas.

### 14.1 Modelo de Cuenta de Crédito (Fiado)

```typescript
interface CuentaCreditoCliente {
  uuid: string;
  empresaId: string;
  clienteId: string;
  limiteCredito: number;        // Máximo permitido (configurable por admin)
  saldoPendiente: number;       // Deuda acumulada actual
  saldoDisponible: number;      // limiteCredito - saldoPendiente
  diasMaximoVencimiento: number; // Días máximos antes de alerta de vencimiento
  estaActivo: boolean;          // false = crédito suspendido
  creadoEn: string;
  actualizadoEn: string;
}

interface VentaCredito {
  uuid: string;
  ventaId: string;              // Referencia a la venta original
  clienteId: string;
  empresaId: string;
  sucursalId: string;
  montoTotal: number;           // Monto total de la venta a crédito
  montoPagado: number;          // Suma de abonos realizados
  saldoPendiente: number;       // montoTotal - montoPagado
  estado: 'pendiente' | 'parcialmente_pagada' | 'liquidada' | 'vencida';
  fechaVenta: string;
  fechaVencimiento: string;     // fechaVenta + diasMaximoVencimiento
  fechaLiquidacion?: string;
  cajeroId: string;             // Quién autorizó el fiado
}

interface AbonoCredito {
  uuid: string;
  ventaCreditoId: string;
  clienteId: string;
  empresaId: string;
  sucursalId: string;
  monto: number;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
  saldoAnterior: number;
  saldoNuevo: number;           // saldoAnterior - monto
  cajeroId: string;
  fechaAbono: string;
  observaciones?: string;
}
```

### 14.2 Flujo de Venta a Crédito (Fiado)

```text
[1] Cajero selecciona método de pago "Crédito / Fiado"
    │
    ├──► Validar que el cliente está registrado (obligatorio)
    ├──► Validar que el cliente tiene cuenta de crédito activa
    ├──► Validar que saldoDisponible >= montoVenta
    │
[2] Si pasa validaciones → confirmar venta
    │
    ├──► Descontar stock normalmente
    ├──► Crear registro VentaCredito con estado 'pendiente'
    ├──► Actualizar saldoPendiente y saldoDisponible del cliente
    ├──► Imprimir ticket con leyenda "VENTA A CRÉDITO" y saldo restante
    │
[3] Si NO pasa validaciones → bloquear
    │
    ├──► Mostrar Toast: "Crédito insuficiente. Límite: $X, Disponible: $Y"
    ├──► Opción: solicitar autorización de supervisor para excepciones
```

### 14.3 Flujo de Abono a Cuenta

```text
[1] Cajero selecciona "Recibir Abono"
    │
    ├──► Buscar cliente por nombre, teléfono o código
    ├──► Mostrar saldo pendiente total y detalle de ventas abiertas
    │
[2] Ingresar monto del abono
    │
    ├──► El abono se aplica a la venta más antigua primero (FIFO)
    ├──► Si el abono cubre una venta completa → estado = 'liquidada'
    ├──► Si es parcial → estado = 'parcialmente_pagada'
    │
[3] Confirmar abono
    │
    ├──► Generar recibo de abono imprimible
    ├──► Actualizar saldo del cliente
    ├──► Registrar en auditoría
```

### 14.4 Estado de Cuenta del Cliente

El administrador o cajero puede generar un **estado de cuenta** del cliente con:

- Nombre del cliente y datos de contacto.
- Tabla de ventas a crédito: fecha, monto, abonos, saldo pendiente por venta.
- Total adeudado actual.
- Límite de crédito y crédito disponible.
- Fecha del último abono.

**Formatos de salida:** Impreso en ticket (ESC/POS), PDF descargable, envío por WhatsApp.

### 14.5 Reglas de Crédito/Fiados

1. Solo se puede fiar a **clientes registrados** con cuenta de crédito activa.
2. El **límite de crédito** lo define el `ADMIN` o `GERENTE` por cada cliente.
3. Si el monto de la venta excede el crédito disponible, la venta se **bloquea** a menos que un supervisor autorice la excepción.
4. Los abonos se aplican en orden **FIFO** (primero la deuda más antigua).
5. El sistema envía **alertas automáticas** cuando:
   - El cliente supera el **80%** de su límite de crédito.
   - Una deuda excede los `diasMaximoVencimiento` configurados.
   - Un cliente con deuda vencida intenta realizar una nueva compra a crédito.
6. El historial de fiados, abonos y liquidaciones es **inmutable** y se conserva en auditoría indefinidamente.
7. El cajero necesita el permiso `CREDITO_VENTA` para autorizar ventas a crédito.

---

## 15. Devoluciones, Cambios y Garantías

El comercio local requiere flexibilidad. CUDII soporta devoluciones garantizando la integridad de caja y de inventario.

### 15.1 Modelos de Datos de Devoluciones

```typescript
type MotivoDevolucion = 
  | 'cambio_opinion' // Vuelve al stock
  | 'cambio_talla'   // Vuelve al stock
  | 'error_cobro'    // Vuelve al stock
  | 'danado'         // Va a merma
  | 'caducado';      // Va a merma

type TipoResolucion = 
  | 'reembolso_efectivo' 
  | 'reembolso_tarjeta'  // (Se asume como Monedero o Reversa Manual en terminal)
  | 'cambio_fisico' 
  | 'saldo_favor';

interface Devolucion {
  uuid: string;
  ventaOriginalId: string;       // Ticket de origen
  empresaId: string;
  sucursalId: string;
  productos: DevolucionProducto[];
  subtotalDevuelto: number;
  impuestosDevueltos: number;
  totalDevuelto: number;
  tipoResolucion: TipoResolucion;
  estado: 'completada' | 'pendiente_aprobacion' | 'rechazada';
  requirioCancelacionCfdi: boolean;
  
  // Auditoría
  creadoPor: string;
  aprobadoPor?: string;          // Si supera el monto máximo del cajero
  fechaDevolucion: string;
}

interface DevolucionProducto {
  productoId: string;
  cantidadDevuelta: number;
  motivo: MotivoDevolucion;
  destino: 'stock' | 'merma';
  montoUnidad: number;
}
```

### 15.2 Reglas de Inventario y Caja

1. **Separación de Destinos:** Si el motivo es `danado` o `caducado`, el `MovimientoInventario` se registra pero no suma al `stockActual` de venta, sino a un registro de **Merma**. Si es otro motivo, suma al `stockActual`.
2. **Impacto en Corte Z:** Toda resolución `reembolso_efectivo` inserta automáticamente un **Egreso de Caja por Devolución** en el turno activo, para que la caja del usuario cuadre.
3. **Resolución por Tarjeta:** Dado que las TPV externas (Clip, MercadoPago) no siempre admiten reversa remota, `reembolso_tarjeta` puede generar un comprobante de "Saldo a Favor" si no se puede cancelar directamente el cobro original.
4. **Validación Fiscal:** Si la venta fue facturada, el sistema emitirá una **Nota de Crédito (Egreso)** por el monto devuelto o cancelará la factura original (si está en periodo de gracia).

---

## 16. Onboarding desde el Día 0 (Operación Inmediata)

CUDII garantiza que cualquier negocio nuevo pueda **realizar su primera venta en menos de 15 minutos** tras registrarse, sin soporte humano ni configuraciones externas.

### 16.1 Wizard de Alta Guiada

```text
[1] Registro de cuenta (email + contraseña)
    │
[2] Datos de la empresa
    │
    ├──► Nombre comercial, razón social, RFC (opcional en este paso)
    ├──► Giro del negocio → selección de catálogo base
    │
[3] Configuración de sucursal
    │
    ├──► Nombre, dirección, zona horaria
    ├──► Precarga de periféricos detectados (si están conectados)
    │
[4] Catálogo base precargado
    │
    ├──► Categorías y productos de demostración para el giro seleccionado
    ├──► El usuario puede editar, eliminar o añadir durante el wizard
    │
[5] Creación de primer usuario cajero
    │
[6] Apertura de primera caja (con fondo de $0 si el usuario prefiere)
    │
[7] ¡Primera venta lista!
```

### 16.2 Catálogos Base por Giro de Negocio

```typescript
type GiroNegocio =
  | 'abarrotes'     // Productos de consumo básico, bebidas, botanas
  | 'ferreteria'    // Herramientas, materiales, tornillería
  | 'papeleria'     // Cuadernos, plumas, material escolar
  | 'ropa'          // Prendas, tallas, colores
  | 'farmacia'      // Medicamentos, productos de cuidado
  | 'carniceria'    // Cortes, productos granel por peso
  | 'panaderia'     // Pan, pasteles, productos por pieza o peso
  | 'salon_belleza' // Servicios (corte, tinte, manicure)
  | 'restaurante'   // Platillos, bebidas, combos (V2.0)
  | 'otro';         // Catálogo vacío, configuración manual

interface CatalogoBase {
  giro: GiroNegocio;
  categorias: CategoriaDemo[];
  productosDemo: ProductoDemo[];
  unidadesMedidaHabilitadas: UnidadMedida[];
  configuracionSugerida: Partial<ConfiguracionSucursal>;
}
```

**Reglas del onboarding:**
1. El wizard debe completarse en un máximo de **10 pasos** visuales.
2. Ningún paso debe requerir datos del SAT, pasarelas de pago u otros servicios externos.
3. Al finalizar, el sistema opera automáticamente con **simuladores locales** (modo demo) para facturación y pagos con tarjeta hasta que el cliente configure las integraciones reales.
4. El catálogo de demostración se marca con una bandera `esDemostracion: true` para que pueda eliminarse masivamente cuando el cliente cargue su catálogo real.
5. La primera apertura de caja funciona **100% offline** sin requerir conexión al backend.

---

## 17. IA Conversacional en el Dashboard

El panel de administración integra un asistente de IA conversacional que responde preguntas del negocio y ejecuta acciones en **lenguaje natural en español**.

### 17.1 Tipos de Interacción

| Tipo | Ejemplo | Acción del Sistema |
| :--- | :--- | :--- |
| **Consulta de datos** | *"¿Cuánto vendí ayer?"* | Query seguro a BD → respuesta formateada |
| **Consulta comparativa** | *"Compara ventas de mis sucursales este mes"* | Query multi-sucursal → tabla/gráfica |
| **Acción ejecutable** | *"Crea un descuento del 15% en bebidas"* | Genera borrador de promoción → solicita confirmación |
| **Alerta programada** | *"Avísame si un cajero aplica descuento > 30%"* | Crea regla de notificación persistente |
| **Reporte en lenguaje natural** | *"Dame el top 10 de productos más vendidos"* | Genera reporte visual inline |

### 17.2 Reglas de Seguridad de la IA Conversacional

```typescript
interface ReglasIAConversacional {
  // La IA solo puede LEER datos del tenant autenticado (nunca cross-tenant)
  aislamientoTenant: true;

  // Las acciones ejecutables siempre requieren confirmación explícita del usuario
  requiereConfirmacionAcciones: true;

  // No se permiten queries que modifiquen datos directamente (INSERT/UPDATE/DELETE)
  soloConsultasLectura: true; // Las acciones se ejecutan vía servicios, no vía SQL

  // Límite de tokens/consultas por minuto para evitar abuso
  limiteConsultasPorMinuto: number; // Configurable por plan de suscripción

  // Los prompts del sistema están hardcodeados y no son modificables por el usuario
  promptsSistemaInmutables: true;
}
```

**Reglas de negocio:**
1. La IA nunca accede a datos de otro tenant. El `empresaId` se inyecta en cada query automáticamente.
2. Toda acción que modifique datos (crear promoción, ajustar precio) genera un **borrador** que el admin debe aprobar.
3. El historial de conversaciones con la IA se registra en auditoría para trazabilidad.
4. El adaptador de LLM sigue el patrón Strategy para permitir cambiar de proveedor (OpenAI, Anthropic, Google, etc.) sin reescribir la lógica.

---

## 18. Migración Asistida con IA desde Otros Sistemas

CUDII elimina la barrera de cambio de POS ofreciendo herramientas de migración inteligente para importar datos desde sistemas anteriores.

### 18.1 Flujo de Migración

```text
[1] Subir archivo (Excel, CSV, XML)
    │
[2] Detección automática de formato con IA
    │
    ├──► Detectar sistema de origen (ASPEL, SAE, Bind, Excel genérico)
    ├──► Mapear campos automáticamente (nombre → nombre, precio → precioVentaBase)
    ├──► Identificar campos no mapeados para revisión manual
    │
[3] Validación inteligente
    │
    ├──► Detectar duplicados (por código de barras, nombre similar)
    ├──► Validar formatos (RFC, precios, fechas)
    ├──► Sugerir correcciones automáticas
    │
[4] Preview y confirmación
    │
    ├──► Mostrar tabla de datos importados vs datos originales
    ├──► Permitir edición fila por fila o masiva
    │
[5] Importación ejecutada
    │
    ├──► Productos → catálogo de la empresa
    ├──► Clientes → base de clientes con datos fiscales
    ├──► Stock → inventario inicial de la sucursal
```

### 18.2 Modelos de Importación

```typescript
interface TareaImportacion {
  uuid: string;
  empresaId: string;
  sucursalId: string;
  tipo: 'productos' | 'clientes' | 'inventario';
  archivoOriginalUrl: string;
  sistemaOrigen: 'aspel' | 'sae' | 'bind' | 'excel_generico' | 'csv_generico' | 'otro';
  estado: 'subido' | 'analizando' | 'mapeado' | 'validando' | 'listo_para_importar' | 'importando' | 'completado' | 'error';
  totalRegistros: number;
  registrosValidos: number;
  registrosConError: number;
  mapeosCampos: MapeoCampo[];
  erroresDetectados: ErrorImportacion[];
  usuarioId: string;
  creadoEn: string;
  completadoEn?: string;
}

interface MapeoCampo {
  campoOrigen: string;       // Nombre del campo en el archivo del usuario
  campoCUDII: string;        // Campo destino en CUDII
  confianzaIA: number;       // 0.0 - 1.0 (nivel de confianza del mapeo automático)
  aprobadoPorUsuario: boolean;
}

interface ErrorImportacion {
  fila: number;
  campo: string;
  valorOriginal: string;
  tipoError: 'duplicado' | 'formato_invalido' | 'campo_requerido' | 'valor_fuera_rango';
  sugerenciaCorreccion?: string;
}
```

**Reglas de migración:**
1. La importación **nunca sobrescribe** datos existentes sin confirmación explícita.
2. Para catálogos con más de **500 productos**, el sistema activa el modo de importación supervisada con validación paso a paso.
3. Los productos importados se marcan con `origenImportacion: 'migracion'` para rastreo.
4. La IA usa el giro del negocio para mejorar el mapeo (ej: si es ferretería, "medida" → "unidadMedida").
5. Los archivos originales se conservan **90 días** para auditoría y se eliminan automáticamente después.

---

## 19. Órdenes de Compra a Proveedores

CUDII cierra el ciclo de inventario: desde la detección de escasez hasta el reabastecimiento físico con trazabilidad total.

### 19.1 Modelo de Orden de Compra

```typescript
interface OrdenCompra {
  uuid: string;
  empresaId: string;
  sucursalId: string;
  proveedorId: string;
  estado: 'borrador' | 'enviada' | 'confirmada' | 'parcialmente_recibida' | 'recibida' | 'cancelada';
  productos: OrdenCompraProducto[];
  subtotal: number;
  impuestos: number;
  total: number;
  observaciones?: string;
  
  // Seguimiento
  fechaCreacion: string;
  fechaEnvio?: string;
  fechaEntregaEstimada?: string;
  fechaRecepcion?: string;
  
  // Origen
  origenSugerencia: 'manual' | 'alerta_stock' | 'ia_prediccion';
  
  // Auditoría
  creadoPor: string;
  aprobadoPor?: string;
  recibidoPor?: string;
}

interface OrdenCompraProducto {
  productoId: string;
  cantidadSolicitada: number;
  cantidadRecibida?: number; // null = pendiente de recepción
  precioUnitarioEstimado: number;
  precioUnitarioReal?: number;
  loteAsignado?: string; // Se asigna al recibir
}
```

### 19.2 Flujo de Orden de Compra

```text
[1] Detección de necesidad de compra
    │
    ├──► Manual: Admin crea orden desde panel
    ├──► Automática: Alerta de stock bajo (stockActual <= stockMinimo)
    ├──► IA: Predicción de demanda sugiere reabastecimiento anticipado
    │
[2] Creación del borrador
    │
    ├──► Seleccionar proveedor (de catálogo de proveedores)
    ├──► Agregar productos y cantidades sugeridas
    ├──► Sistema precalcula costos estimados
    │
[3] Aprobación y envío
    │
    ├──► Requiere aprobación de ADMIN o GERENTE
    ├──► Genera PDF con membrete del negocio (Whitelabel)
    ├──► Envía automáticamente al proveedor por email o WhatsApp
    │
[4] Recepción de mercancía
    │
    ├──► Flujo de confirmación en la app (ALMACÉN o GERENTE)
    ├──► Verificar cantidades recibidas vs solicitadas
    ├──► Si hay discrepancia → marcar como 'parcialmente_recibida'
    ├──► Crear lote nuevo si el producto requiere lote
    ├──► Actualizar stock automáticamente (tipo movimiento: 'compra')
```

### 19.3 Modelo de Proveedor

```typescript
interface Proveedor {
  uuid: string;
  empresaId: string;
  nombre: string;
  razonSocial?: string;
  rfc?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  contactoWhatsapp?: string;
  direccion?: Direccion;
  diasEntregaPromedio?: number;
  condicionesPago?: string; // "Contado", "Crédito 30 días", etc.
  productosAsociados: string[]; // UUIDs de productos que provee
  estaActivo: boolean;
  desactivadoEn?: string;
  desactivadoPorId?: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

**Reglas de órdenes de compra:**
1. Solo roles `ADMIN` y `GERENTE` pueden crear y aprobar órdenes de compra.
2. El rol `ALMACEN` puede confirmar recepción de mercancía pero no crear órdenes.
3. Al recibir mercancía, el sistema genera automáticamente un `MovimientoInventario` de tipo `'compra'` por cada producto.
4. Si la cantidad recibida difiere de la solicitada, se marca la orden como `'parcialmente_recibida'` y se notifica al admin.
5. Los PDFs de órdenes de compra usan la identidad Whitelabel del negocio (logo, colores, datos fiscales).
6. El historial de órdenes de compra se conserva indefinidamente para auditoría.

---

## 20. Fechas y Husos Horarios

* **Regla estricta:** Todas las fechas guardadas en la base de datos (y transmitidas a través de la API) DEBEN usar estrictamente el formato **ISO 8601 en UTC**. 
* La conversión a la zona horaria local de la sucursal o del usuario solo debe realizarse en la capa de presentación (Frontend/POS).

---

## 21. Logs y Formato de Métricas

* **Logs centralizados:** Todo log del backend (NestJS) deberá registrarse en un formato JSON estructurado que incluya: `timestamp` (ISO 8601), `level` (info, warn, error), `context` (módulo o clase), `message`, y `tenantId` (si aplica).
* **Métricas de rendimiento:** La visualización de métricas (uso de memoria, tiempos de respuesta, tasa de error) debe exponerse utilizando formatos compatibles con herramientas estándar (ej. endpoints de Prometheus) o reportes gráficos dentro del Dashboard usando agregaciones en PostgreSQL/Redis.

---

## 22. Generación y Acceso a Reportes (RBAC)

* **Restricción por Rol (RBAC):** El acceso a los reportes de ventas, inventarios y caja chica está fuertemente vinculado a los permisos. Un *Cajero* solo puede ver reportes de su propio turno/caja. Un *Gerente* de sucursal puede ver todo lo de su sucursal. Un *Admin/Dueño* tiene acceso global (multisucursal).
* **Reportes Contextuales:** En lugar de solo tener un "Módulo de Reportes" aislado, el sistema permite generar reportes específicos desde las páginas clave:
  - **En página de Producto:** Botón para generar reporte de "Desempeño y Rotación de este Producto".
  - **En página de Vendedor/Cajero:** Botón para reporte de "Rendimiento y Ventas del empleado".
  - **En página de Caja/Terminal:** Botón para reporte de "Historial de Cortes y Anomalías de esta Caja".
* Estos reportes contextuales utilizan los mismos filtros e infraestructura subyacente pero pre-parametrizados para maximizar la usabilidad del gerente.

---

## 23. Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant. |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 5 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 6 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación (este archivo). |
| 7 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 8 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |
```
