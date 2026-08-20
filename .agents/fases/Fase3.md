# Fase 3 — Terminal POS y Ciclo de Venta Completo

> **Estado:** ✅ Completada  
> **Versión objetivo:** V1.0  
> **Dependencia de:** Fase 2 (completada)  
> **Produce para:** Fase 4

---

## Objetivo

Implementar el núcleo operacional del negocio: la pantalla de caja del cajero. Esta fase construye el ciclo completo de una transacción comercial:

`Apertura de Caja → Búsqueda de Producto → Carrito → Cobro → Ticket → Corte de Caja → Cierre`

Al finalizar, un cajero puede abrir su turno, realizar ventas (con efectivo o tarjeta simulada), emitir tickets en pantalla, realizar un corte X/Z y procesar devoluciones básicas sobre ventas anteriores.

---

## Alcance

**Incluido:**
- Modelos de BD para venta: `Venta`, `DetalleVenta`, `PagoVenta`
- Modelos de BD para caja: `SesionCaja`, `CorteX`, `CorteZ`, `RetiroParcial`
- Modelos de BD para devolución: `Devolucion`, `DevolucionProducto`
- Módulo `cash-register`: apertura, retiro parcial, corte X y corte Z
- Módulo `sales`: registro atómico de venta (carrito → descuento inventario → pago)
- Módulo `returns`: flujo de devolución con separación stock/merma
- Terminal POS en frontend: 2 paneles (búsqueda + carrito)
- Modal de cobro con cálculo de cambio automático
- Ticket de venta en pantalla (imprimible en Fase 6)
- Pantalla de Devolución

**No incluido:**
- Integración real de pasarela de pago (en esta fase, `TARJETA` es simulado)
- Impresión física de tickets (Fase 6)
- Apertura de cajón de dinero (Fase 6)
- Ventas a crédito/fiado (Fase 4)
- Pago mixto (efectivo + tarjeta simultáneo) — opcional en MVP

---

## Prerequisitos

- Fase 2 completada y validada
- Existen al menos 5 productos activos con stock en la BD (creados en Fase 2 o via Onboarding)
- Existe al menos 1 usuario con rol `CAJERO` creado

---

## Entradas

| Artefacto de Fase 2 | Uso en Fase 3 |
|--------------------|--------------|
| `GET /products` con búsqueda por nombre y código | Buscador de la terminal POS |
| `InventarioSucursal.stockActual` | Validación de stock antes de agregar al carrito |
| Módulo `inventory` con lógica atómica de ajuste | El registro de venta reutiliza el mismo patrón transaccional |
| `MovimientoInventario` | La venta inserta registros de tipo `venta`; la devolución inserta `devolucion_venta` |
| Usuario con rol `CAJERO` | Requerido para abrir sesión de caja |

---

## Actividades

### C1 — Extender el Schema Prisma: Venta y Caja

**Qué hacer:** Agregar todos los modelos relacionados con el ciclo de venta y la sesión de caja.

**Modelos a agregar:**

```
SesionCaja     — turno de trabajo del cajero (apertura/cierre)
CorteX         — corte parcial durante el turno
CorteZ         — cierre definitivo del día
RetiroParcial  — retiros de efectivo durante el turno
Venta          — cabecera del ticket de venta
DetalleVenta   — líneas de productos del ticket
PagoVenta      — método(s) de pago del ticket
Devolucion     — cabecera de devolución vinculada a una venta
DevolucionProducto — líneas de productos devueltos
```

**Campos clave de `Venta`:**
```prisma
model Venta {
  id            String      @id @default(uuid())
  empresaId     String
  sucursalId    String
  cajaId        String
  sesionCajaId  String      // Vínculo con el turno activo
  cajeroId      String
  folio         Int         // Número de ticket autoincremental por empresa
  subtotal      Float
  descuento     Float       @default(0)
  impuestos     Float       @default(0)
  total         Float
  estado        EstadoVenta @default(completada)
  esDemostracion Boolean    @default(false)
  creadoEn      DateTime    @default(now())
  detalles      DetalleVenta[]
  pagos         PagoVenta[]
  devoluciones  Devolucion[]
}

enum EstadoVenta { completada, cancelada, reembolsada }
enum MetodoPago  { efectivo, tarjeta, transferencia, voucher, credito }
```

**Ejecutar:** `npx prisma migrate dev --name add_venta_caja_devolucion`

**Resultado esperado:** Todas las tablas creadas. `npx prisma migrate status` limpio.

---

### C2 — Módulo `cash-register` (Backend)

**Qué hacer:** Implementar el ciclo completo de sesión de caja.

**Endpoints:**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/cash-register/current` | Obtener sesión activa de la caja actual | CAJERO, GERENTE |
| POST | `/cash-register/open` | Abrir nueva sesión con fondo inicial | CAJERO, GERENTE |
| POST | `/cash-register/withdrawal` | Registrar retiro parcial de efectivo | CAJERO, GERENTE |
| POST | `/cash-register/close-x` | Generar corte X (parcial, no cierra el turno) | CAJERO, GERENTE |
| POST | `/cash-register/close-z` | Cerrar el turno definitivamente (Corte Z) | GERENTE, ADMIN |

**Lógica del Corte Z:**
- Solo puede realizarse una vez por `SesionCaja`.
- Calcula: `efectivoEsperado = fondoInicial + ventasEfectivo - retiros + ingresosExtra`.
- El cajero ingresa `efectivoContado`; el sistema calcula `diferencia = efectivoContado - efectivoEsperado`.
- En modo **Ciego**: no muestra `efectivoEsperado` al cajero hasta que él ingrese su conteo.
- En modo **Abierto**: muestra el valor esperado en tiempo real.

**Resultado esperado:** Un cajero puede abrir su caja, el sistema registra la sesión. Al cerrar, el corte Z calcula correctamente.

---

### C3 — Módulo `sales` (Backend)

**Qué hacer:** Implementar el endpoint de registro de venta como una transacción ACID completa.

**Endpoint principal:**

```
POST /sales
Body: {
  sesionCajaId: string,
  productos: [{ productoId, cantidad, precioUnitario, unidad }],
  pagos: [{ metodo: 'efectivo', montoRecibido: 100, cambio: 15 }]
}
```

**Flujo interno de `createSale()` dentro de `prisma.$transaction`:**
```
1. Validar que la SesionCaja existe y está abierta
2. Para cada producto:
   a. Obtener InventarioSucursal con SELECT FOR UPDATE
   b. Validar que stockActual >= cantidad requerida
   c. Calcular subtotal del ítem
3. Calcular subtotal, impuestos y total de la venta
4. Crear registro Venta (estado: completada)
5. Crear registros DetalleVenta (uno por producto)
6. Crear registros PagoVenta (uno por método de pago)
7. Para cada producto: UPDATE InventarioSucursal (decrementar stock)
8. Para cada producto: INSERT MovimientoInventario (tipo: 'venta')
9. Retornar la venta completa con folio y cambio calculado
```

**Reglas críticas:**
- Si cualquier paso falla → rollback completo, ningún dato queda a medias.
- Si el stock de un producto es insuficiente → error `409 Conflict` con mensaje claro.
- El `folio` se incrementa por secuencia por `empresaId` (usar `nextval` de PostgreSQL o una estrategia atómica).

**Endpoints adicionales:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/sales` | Listar ventas del turno activo (paginado) |
| GET | `/sales/:id` | Detalle completo de una venta |
| POST | `/sales/:id/cancel` | Cancelar venta (dentro del tiempo permitido) |

**Resultado esperado:** Una venta registra todos los datos correctamente, descuenta el inventario y genera los movimientos. Si el stock es insuficiente, rechaza la venta sin afectar ningún dato.

---

### C4 — Módulo `returns` (Backend)

**Qué hacer:** Implementar el flujo de devolución con separación de destino (stock vs merma).

**Endpoint:**
```
POST /returns
Body: {
  ventaOriginalId: string,
  productos: [{
    productoId: string,
    cantidadDevuelta: number,
    motivo: 'cambio_opinion' | 'cambio_talla' | 'danado' | 'caducado' | 'error_cobro',
    destino: 'stock' | 'merma'
  }],
  tipoResolucion: 'reembolso_efectivo' | 'cambio_fisico' | 'saldo_favor'
}
```

**Lógica interna (dentro de `prisma.$transaction`):**
```
1. Validar que la Venta existe y está en estado 'completada'
2. Validar que las cantidades devueltas <= cantidades compradas originalmente
3. Crear registro Devolucion
4. Para cada producto con destino='stock':
   - UPDATE InventarioSucursal (incrementar stock)
   - INSERT MovimientoInventario (tipo: 'devolucion_venta')
5. Para cada producto con destino='merma':
   - INSERT MovimientoInventario (tipo: 'ajuste_negativo', motivo='merma_devolucion')
   - No se incrementa stockActual
6. Si tipoResolucion='reembolso_efectivo':
   - Registrar egreso en la SesionCaja activa
7. Actualizar estado de la Venta original si todos los items fueron devueltos → 'reembolsada'
```

**Resultado esperado:** Los productos con destino `stock` regresan al inventario. Los de `merma` no. La caja refleja el egreso si fue reembolso en efectivo.

---

### C5 — Terminal POS (Frontend)

**Qué hacer:** Reemplazar el placeholder de `PosView.tsx` por la terminal POS completa.

**Layout de 2 columnas:**

```
┌─────────────────────────────────────────────────────────┐
│  [PANEL IZQUIERDO — 60%]    │  [PANEL DERECHO — 40%]    │
│                             │                            │
│  🔍 Buscador por nombre     │  🧾 Ticket en curso        │
│     o código de barras      │                            │
│                             │  Coca-Cola x1   $18.00    │
│  Grilla de acceso rápido    │  Sabritas   x2   $30.00   │
│  (productos frecuentes)     │  ─────────────────────    │
│                             │  Subtotal:       $48.00   │
│                             │  IVA:             $7.68   │
│                             │  Total:          $55.68   │
│                             │                            │
│                             │  [COBRAR $55.68 →]        │
└─────────────────────────────────────────────────────────┘
```

**Componentes a crear:**
- `ProductSearch.tsx` — buscador con debounce de 300ms, muestra resultados en dropdown
- `ProductGrid.tsx` — grilla de productos frecuentes con imagen, nombre y precio
- `CartItem.tsx` — ítem de carrito con controles +/- y botón de eliminar (áreas táctiles ≥ 48px)
- `CartSummary.tsx` — resumen de subtotal, impuestos y total en tiempo real
- `CheckoutModal.tsx` — modal de cobro con selector de método de pago y cálculo de cambio
- `VoucherModal.tsx` — resumen de venta exitosa con el cambio a entregar
- `OpenCashRegisterModal.tsx` — aparece si no hay sesión de caja activa al entrar a la POS

**Lógica del carrito (estado global con Zustand o Context):**
- El carrito vive en estado global para persistir entre navegaciones del cajero.
- Al agregar un producto, verificar en tiempo real si hay stock disponible.
- Si el stock es 0 → mostrar badge `AGOTADO` y no permitir agregar.

**Resultado esperado:** El cajero puede buscar productos, agregarlos al carrito, cobrar, ver el cambio y finalizar la venta. La terminal está optimizada para uso táctil.

---

### C6 — Pantalla de Devoluciones (Frontend)

**Qué hacer:** Crear la vista de procesamiento de devoluciones.

**Flujo en pantalla:**
1. Cajero busca el ticket original por folio o escaneo de código QR.
2. Se muestra el detalle del ticket (productos, cantidades, montos).
3. El cajero selecciona qué productos devolver, la cantidad y el motivo.
4. El sistema muestra el destino recomendado (stock o merma) según el motivo.
5. El cajero selecciona el tipo de resolución (efectivo, cambio físico, saldo a favor).
6. Confirma → el sistema procesa la devolución y muestra el resumen.

**Resultado esperado:** El flujo completo de devolución funciona sin errores desde la UI.

---

## Entregables

- [ ] Migración `add_venta_caja_devolucion` aplicada en Prisma
- [ ] `backend/src/modules/cash-register/` — módulo completo
- [ ] `backend/src/modules/sales/` — módulo completo con transacción atómica
- [ ] `backend/src/modules/returns/` — módulo completo
- [ ] `frontend/src/views/PosView.tsx` — terminal completa (reemplaza placeholder)
- [ ] `frontend/src/components/pos/ProductSearch.tsx`
- [ ] `frontend/src/components/pos/CartItem.tsx`
- [ ] `frontend/src/components/pos/CheckoutModal.tsx`
- [ ] `frontend/src/components/pos/VoucherModal.tsx`
- [ ] `frontend/src/views/DevolucionesView.tsx`
- [ ] Tests unitarios de `sales.service.ts` (cálculo de totales, validación de stock)

---

## Validaciones

### Pruebas funcionales
1. Abrir sesión de caja con fondo inicial de $500 → verificar `SesionCaja` en BD.
2. Buscar producto `Coca-Cola` por nombre → aparece en resultados.
3. Buscar producto por código de barras → se agrega directamente al carrito.
4. Intentar agregar un producto con stock = 0 → el sistema muestra `AGOTADO`.
5. Agregar 3 productos, cobrar en efectivo con $200, monto total $155.50 → el sistema muestra cambio de $44.50.
6. Verificar en BD: `Venta` creada, `DetalleVenta` por cada producto, `PagoVenta` con método `efectivo`, `InventarioSucursal` decrementado, `MovimientoInventario` de tipo `venta`.
7. Intentar vender más unidades de las que hay en stock → sistema rechaza con error 409.
8. Hacer Corte X → el resumen muestra las ventas del turno correctamente.
9. Hacer Corte Z → la sesión queda cerrada; no se puede vender más sin abrir nueva sesión.
10. Procesar devolución de 1 Coca-Cola por `error_cobro` → el stock incrementa en 1.

### Prueba de atomicidad
- Simular un error en el paso 7 del flujo de venta (ej. BD desconectada) → verificar que ni la `Venta`, ni los `DetalleVenta`, ni el descuento de inventario quedaron registrados.

---

## Criterios de Salida

- [ ] El ciclo completo apertura → venta → corte Z funciona sin errores.
- [ ] Una venta descuenta el inventario atómicamente (todo o nada).
- [ ] El cálculo del cambio en efectivo es correcto en todos los casos.
- [ ] El Corte Z calcula correctamente el efectivo esperado vs. contado.
- [ ] Las devoluciones a stock incrementan `stockActual`; las de merma no lo hacen.
- [ ] Tests unitarios del servicio de ventas pasan (`npm run test`).

---

## Dependencias para la Fase 4

| Artefacto producido | Cómo lo usa Fase 4 |
|--------------------|-------------------|
| Modelo `Venta` con `clienteId` (nullable en esta fase) | Fase 4 agrega el vínculo real con el modelo `Cliente` |
| `GET /sales` con filtros por fecha y cajero | Los reportes de Fase 4 reutilizan estos endpoints |
| `SesionCaja` con `totalVentasEfectivo`, `totalVentasTarjeta` | El dashboard de Fase 4 muestra el resumen del día en tiempo real |
| `MovimientoInventario` con todos los tipos | Los reportes de inventario de Fase 4 los consultan |
| Cálculo de totales y márgenes en `DetalleVenta` | El reporte de margen de ganancia de Fase 4 usa `precioCompra` vs `precioUnitario` |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Condición de carrera: 2 cajeros venden el último producto simultáneamente | `SELECT FOR UPDATE` en la transacción de venta garantiza bloqueo optimista a nivel de fila |
| El folio de ticket no es único si hay concurrencia | Usar una secuencia de PostgreSQL (`SERIAL` o `nextval`) para garantizar unicidad atómica |
| El estado del carrito se pierde si el cajero refresca la página | Persistir el carrito en `sessionStorage` o en un estado de servidor con Redis |
| El Corte Z bloquea ventas pero el frontend no lo refleja | Al abrir la POS, siempre verificar `GET /cash-register/current`; si no hay sesión activa, mostrar modal de apertura |

---

## Extensión: Fase 3+ — Trazabilidad y Lotes

**Estado:** ✅ Completada

Se implementó una extensión significativa sobre la Fase 3 que añade trazabilidad completa de inventario:

### Funcionalidades añadidas
- **Consumo FEFO/FIFO de lotes**: `consumirLotes` consume primero el lote con caducidad más cercana
- **Gestión de caducidades**: `tieneCaducidad` (antes `requiereLote`) controla si la fecha es obligatoria al recibir
- **Merma**: Devoluciones con `destino=merma` registran movimiento sin decrementar lotes
- **Venta a granel**: Decimales para unidades continuas (kilo, litro, metro)
- **Validación de unidades**: Discretas (pieza, caja) requieren enteros; continuas permiten decimales
- **Descuentos**: `descuentoGeneral` (monto fijo) y `descuento` por item
- **Auto-creación de lotes**: Si no hay lotes activos, se crea uno desde `InventarioSucursal`

### Archivos clave
- `backend/src/common/validators/unidad.util.ts` — Validación de unidades
- `backend/src/inventory/lotes.helper.ts` — Consumo FEFO + auto-creación
- `backend/src/sales/sales.service.ts` — Integración de validación en venta
- `backend/src/returns/returns.service.ts` — Validación en devoluciones
- `tests/run_tests.js` — Suite de 39 pruebas API

### Documentación
- `docs/FASE4_Trazabilidad.md` — Documentación técnica completa
- `docs/GUIA_PRUEBAS_FASE4.md` — Guía de pruebas (manual + automatizada)
- `.agents/REGLAS_NEGOCIO.md` — Reglas de negocio actualizadas
