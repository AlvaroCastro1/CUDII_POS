# Fase 4 — Clientes, Dashboard, Reportes y Arquitectura

> **Estado:** 🔴 PENDIENTE  
> **Versión objetivo:** V1.5  
> **Dependencia de:** Fase 3+ (completada)  
> **Produce para:** Fase 5

---

## Objetivo

Añadir las capas de fidelización, crédito, visibilidad operacional y **consistencia arquitectónica** al sistema. Esta fase convierte CUDII de un simple registrador de ventas en una herramienta de gestión integral del negocio:

- El cajero puede asociar ventas a un cliente registrado.
- El gerente ve en su dashboard las métricas del día.
- El dueño puede consultar márgenes, reportes de inventario y gestionar fiados.
- **La base de datos tiene índices adecuados, paginación consistente y cero N+1 queries.**
- **Todos los endpoints del backend están consumidos por el frontend (sin huérfanos).**

---

## Alcance

**Incluido:**
- Limpieza de schema: eliminación de campos muertos y constraints faltantes
- Índices en las 25+ FKs críticas para performance
- Fix de route collisions (2 endpoints inalcanzables)
- Estandarización de paginación a un formato único
- Fix de 4 patrones N+1 en los services más calientes
- Modelos `Cliente`, `CuentaCreditoCliente`, `VentaCredito`, `AbonoCredito`
- CRUD de Clientes con datos fiscales opcionales
- Programa de puntos y niveles (tiers)
- Módulo de Crédito/Fiados: apertura de cuenta, ventas a crédito, registro de abonos
- Dashboard del negocio con métricas en tiempo real
- Reportes básicos exportables: ventas del día, inventario, top productos, cortes de caja
- Historial de ventas y devoluciones con filtros
- RBAC en sidebar (admin vs gerente vs cajero)
- Consumo de endpoints huérfanos o eliminación de los mismos

**No incluido:**
- Rotación de secrets (checklist pre-producción, ver sección final)
- IA conversacional (Fase 5)
- Órdenes de compra (Fase 5)
- Facturas CFDI (Fase 6)
- Notificaciones automáticas multicanal (Fase 5)

---

## Prerequisitos

- Fase 3+ completada y validada
- El modelo `Venta` tiene el campo `clienteId` como nullable (preparado desde Fase 3+)
- El sistema de `MovimientoInventario` y `SesionCaja` está generando datos reales

---

## Entradas

| Artefacto de Fase 3+ | Uso en Fase 4 |
|--------------------|--------------|
| Modelo `Venta` con `clienteId` nullable | Se vincula con el nuevo modelo `Cliente` |
| `GET /sales` con filtros | Base para los endpoints de reportes |
| `SesionCaja` con totales por método de pago | Dashboard muestra resumen del día en tiempo real |
| `MovimientoInventario` con todos los tipos | Reporte de movimientos de inventario |
| `DetalleVenta` con `precioUnitario` | Cálculo de margen de ganancia en reportes |

---

## Actividades

### Etapa A — Cimientos Técnicos

> Estas actividades se ejecutan primero. No tienen UI pero son prerequisites críticos para la performance y consistencia del sistema.

---

### D0 — Limpieza de Schema y Constraints

**Campos a eliminar:**

| Modelo | Campo | Razón |
|--------|-------|-------|
| `Sucursal` | `direccion` | Zero reads, zero writes en todo el codebase |
| `Venta` | `notas` | Escrito en `sales.service.ts:271` pero ningún frontend lo envía ni muestra |
| `LogActividad` | `direccionIP` | Siempre null — ningún caller lo pasa |
| `LogActividad` | `agenteUsuario` | Siempre null — ningún caller lo pasa |
| `Caja` | `codigo` | Leído en `sales.service.ts:55` pero nunca escrito (siempre null) |

**Campos a eliminar en DTOs:**

| DTO | Campo | Razón |
|-----|-------|-------|
| `abrir-caja.dto.ts` | `notas` | `SesionCaja` no tiene columna `notas`; el campo se descarta silenciosamente |

**Constraint faltante a agregar:**

```prisma
model MovimientoInventario {
  // ... existente ...
  sucursalId  String
  sucursal    Sucursal @relation(fields: [sucursalId], references: [id])  // ← AGREGAR
}
```

**Fix en `sales.service.ts`:** Eliminar la línea que escribe `Venta.notas` y el campo del DTO `crear-venta.dto.ts`.

**Ejecutar:** `npx prisma migrate dev --name cleanup_dead_fields`

---

### D1 — Índices en FKs Críticas

**P0 — Crítico (venta es la tabla más caliente):**

```prisma
model Venta {
  @@index([empresaId, creadoEn])
  @@index([sucursalId, creadoEn])
  @@index([sesionCajaId])
  @@index([cajeroId])
  @@index([cajaId])
  @@unique([empresaId, folio])  // findOneSale por folio + integridad
}
```

**P1 — Alto (hot paths):**

```prisma
model DetalleVenta        { @@index([ventaId]) @@index([productoId]) }
model PagoVenta           { @@index([ventaId]) }
model DetalleVentaLote    { @@index([detalleVentaId]) }
model MovimientoInventario{ @@index([productoId]) @@index([loteId]) @@index([sucursalId]) @@index([usuarioId]) @@index([fechaHora]) }
model SesionCaja          { @@index([cajaId, estado]) @@index([cajeroId]) }
model Devolucion          { @@index([ventaId]) @@index([fechaHora]) @@index([usuarioId]) }
```

**P2 — Medio:**

```prisma
model DevolucionProducto  { @@index([devolucionId]) @@index([loteId]) }
model RecepcionDetalle    { @@index([recepcionId]) @@index([productoId]) }
model RetiroParcial       { @@index([sesionCajaId]) @@index([usuarioId]) }
model CorteX              { @@index([sesionCajaId]) @@index([usuarioId]) }
model CorteZ              { @@index([usuarioId]) @@index([autorizadoPorId]) }
model Merma               { @@index([loteId]) @@index([usuarioId]) @@index([fechaHora]) }
model RecepcionMercancia  { @@index([usuarioId]) }
```

**P3 — Tenant-scoping (tablas pequeñas, seguro barato):**

```prisma
model Sucursal         { @@index([empresaId]) }
model Caja             { @@index([sucursalId]) }
model Usuario          { @@index([empresaId]) }
model Categoria        { @@index([empresaId]) }
model PrecioPorUnidad  { @@index([productoId]) }
model Producto         { @@index([empresaId, estaActivo]) @@index([empresaId, codigoBarras]) }
model Lote             { @@index([productoId]) }
```

**Ejecutar:** `npx prisma migrate dev --name add_critical_indexes`

---

### D2 — Fix Route Collisions y CORS

**Route collisions (2 endpoints inalcanzables):**

| Endpoint actual | Problema | Solución |
|----------------|----------|----------|
| `PATCH /notifications/read-all` | Colisiona con `PATCH /notifications/:id` — NestJS matchea `read-all` como un `:id` | Renombrar a `PATCH /notifications/mark-all-read` |
| `PATCH /suppliers/:id/reactivate` | Colisiona con `PATCH /suppliers/:id` — NestJS matchea `reactivate` como un `:id` | Cambiar a `PATCH /suppliers/:id/reactivate-status` |

**CORS Restrictivo:**

```typescript
// main.ts — reemplazar CORS abierto
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
```

**Frontend:** Actualizar las llamadas en `NotificationBell.tsx` y `ProveedoresView.tsx` para usar los nuevos paths.

---

### D3 — Estandarización de Paginación

**Formato único a implementar en TODOS los endpoints paginados:**

```typescript
// Respuesta
{
  "data": [...],
  "meta": {
    "total": number,
    "page": number,
    "limit": number,
    "totalPages": number,
    "hasNextPage": boolean,
    "hasPrevPage": boolean
  }
}

// Query params: ?page=1&limit=20
// Clamp: Math.min(limit, 100)
// Guard: totalPages = Math.ceil(total / limitSafe) || 1
```

**Endpoints a migrar:**

| Endpoint | Formato actual | Cambio necesario |
|----------|---------------|-----------------|
| `GET /sales` | Spanish (`datos`, `pagina`) | Cambiar a inglés (`data`, `page`) + agregar nav flags |
| `GET /notifications` | Spanish (`datos`, `pagina`) | Cambiar a inglés + agregar nav flags |
| `GET /audit` | Híbrido (`datos` input español, `meta` inglés) | Unificar input a `page/limit` + cambiar payload a `data` |
| `GET /suppliers` | English pero sin `hasPrevPage` | Agregar `hasPrevPage` + limit clamp |
| `GET /inventory/lotes` | English pero sin nav flags | Agregar `hasNextPage`/`hasPrevPage` |

**Endpoints ya correctos (no cambiar):** users, products, categories, inventory/stock.

---

### D4 — Fix de Patrones N+1

**4 services con patrones N+1 confirmados:**

#### `sales.service.ts` (PEOR — cada venta genera 80+ queries)

| Línea | Problema | Solución |
|-------|----------|----------|
| `:76` | `for item → producto.findFirst` | Pre-fetch con `findMany({ where: { id: { in: ids } } })` + Map |
| `:76` | `for item → inventarioSucursal.findUnique` | Pre-fetch inventarios de la sucursal en lote |
| `:168` | `for lote → movimientoInventario.create` | Cambiar a `createMany` |
| `:301` | `for producto → detalleVentaLote.createMany` | Aplanar todos los lotes en un solo `createMany` |
| `:317` | Re-read idéntico al `:279` | Eliminar — usar resultado del create |

#### `returns.service.ts`

| Línea | Problema | Solución |
|-------|----------|----------|
| `:158` | `for lote → lote.findUnique` (solo para obtener `estado`) | Agregar `include: { lote: true }` al query de venta en `:40` |
| `:168,180` | `for lote → movimientoInventario.create` | Cambiar a `createMany` |

#### `inventory.service.ts`

| Línea | Problema | Solución |
|-------|----------|----------|
| `:146` | `for item → producto.findFirst` | Pre-fetch con `findMany` + Map (igual que returns) |
| `:222` | Re-read de lote recién creado en `:163` | Usar el return value de `create()` |
| `:472,497` | `for lote → notificacion.findFirst` + `notificarAdmins` | Batch dedup: un solo `findMany` + Set |

#### `lotes.helper.ts`

| Línea | Problema | Solución |
|-------|----------|----------|
| `:139` | `for lote → lote.update` | Mantener individual (cada lote tiene cantidad distinta), pero optimizar el caller |

---

### Etapa B — Funcionalidad Core

---

### D5 — Extender Schema Prisma: Clientes y Crédito

**Modelos a agregar:**

```prisma
model Cliente {
  id                String   @id @default(uuid())
  empresaId         String
  nombre            String
  apellidoPaterno   String?
  email             String?
  telefono          String?
  rfc               String?
  puntosActuales    Int      @default(0)
  puntosHistoricos  Int      @default(0)
  tier              TierLealtad @default(sin_tier)
  estaActivo        Boolean  @default(true)
  creadoEn          DateTime @default(now())
  actualizadoEn     DateTime @updatedAt
  ventas            Venta[]
  cuentaCredito     CuentaCreditoCliente?
}

enum TierLealtad { sin_tier, bronce, plata, oro, platino }

model CuentaCreditoCliente {
  id                    String   @id @default(uuid())
  clienteId             String   @unique
  cliente               Cliente  @relation(fields: [clienteId], references: [id])
  limiteCredito         Float
  saldoPendiente        Float    @default(0)
  diasMaximoVencimiento Int      @default(30)
  estaActivo            Boolean  @default(true)
  creadoEn              DateTime @default(now())
  ventasCredito         VentaCredito[]
}

model VentaCredito {
  id             String   @id @default(uuid())
  ventaId        String   @unique
  clienteId      String
  montoTotal     Float
  montoPagado    Float    @default(0)
  saldoPendiente Float
  estado         EstadoCredito @default(pendiente)
  fechaVencimiento DateTime
  abonos         AbonoCredito[]
}

enum EstadoCredito { pendiente, parcialmente_pagada, liquidada, vencida }
```

**Ejecutar:** `npx prisma migrate dev --name add_clientes_credito_lealtad`

---

### D6 — Módulo `customers` (Backend) + Integración en Venta

**Endpoints:**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/customers` | Listar clientes con búsqueda | ADMIN, GERENTE, CAJERO |
| GET | `/customers/:id` | Detalle con puntos, historial de compras, saldo crédito | ADMIN, GERENTE |
| POST | `/customers` | Crear cliente | ADMIN, GERENTE, CAJERO |
| PATCH | `/customers/:id` | Editar datos | ADMIN, GERENTE |
| DELETE | `/customers/:id` | Soft delete | ADMIN |
| POST | `/customers/:id/credit-account` | Abrir cuenta de crédito con límite | ADMIN, GERENTE |
| POST | `/customers/:id/payment` | Registrar abono a deuda | CAJERO, GERENTE |
| GET | `/customers/:id/statement` | Generar estado de cuenta | ADMIN, GERENTE |

**Reglas de crédito:**
- Al registrar una `VentaCredito`, validar que `saldoDisponible >= montoVenta`, donde `saldoDisponible = limiteCredito - saldoPendiente`.
- Si el monto excede el límite → error `422 Unprocessable Entity` con mensaje claro.
- Los abonos se aplican en orden FIFO: pagan primero la `VentaCredito` más antigua.
- Al liquidar completamente una `VentaCredito` → actualizar `estado: 'liquidada'` y registrar `fechaLiquidacion`.

**Integración en `POST /sales`:**
- Aceptar `clienteId` opcional.
- Si `clienteId` + método `credito` → crear `VentaCredito` en lugar de `PagoVenta`.
- Acumular puntos al completar la venta: `puntosGanados = floor(total / 10)`.
- Recalcular `tier` basado en `puntosHistoricos`:
  - 0 → `sin_tier`, 100 → `bronce`, 500 → `plata`, 1500 → `oro`, 5000 → `platino`.

---

### D7 — Dashboard (Frontend)

**Tarjetas de métricas (KPIs del día):**
- Ventas del día (total en pesos)
- Número de transacciones
- Ticket promedio
- Total en efectivo vs tarjeta
- Alertas de stock bajo (badges rojos)

**Gráficas:**
- Ventas por hora del día (gráfica de barras)
- Top 5 productos más vendidos hoy (gráfica horizontal)

**Widgets adicionales:**
- Clientes con crédito próximo a vencer (tabla)
- Últimas ventas (feed en tiempo real)
- Estado de las cajas abiertas

**Cómo:** Usar `recharts` para las gráficas. Los datos se obtienen de endpoints de reportes con polling cada 30 segundos o usando Server-Sent Events.

---

### D8 — Módulo `reports` (Backend y Frontend)

**Endpoints de reportes:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reports/sales-summary` | Resumen de ventas (por día/semana/mes) |
| GET | `/reports/top-products` | Top N productos más vendidos |
| GET | `/reports/inventory` | Estado de inventario con alertas |
| GET | `/reports/cash-register` | Histórico de cortes X/Z con diferencias |
| GET | `/reports/margin` | Margen de ganancia por producto/categoría |

**Todos los reportes:**
- Aceptan parámetros: `fechaInicio`, `fechaFin`, `sucursalId` (si el admin tiene múltiples).
- Respetan RBAC: un `CAJERO` solo ve datos de su turno; un `GERENTE` ve su sucursal; un `ADMIN` ve todo.
- Tienen endpoint adicional `?format=csv` que devuelve el reporte en CSV descargable.

---

### Etapa C — Consistencia Full-Stack

---

### D9 — Consumo de Endpoints Huérfanos y RBAC

**Endpoints huérfanos a resolver:**

| Endpoint | Acción | Detalle |
|----------|--------|---------|
| `GET /returns` | **Consumir** | Agregar pestaña/lista en DevolucionesView que muestre historial de devoluciones |
| `GET /cash-register/close-x` | **Consumir** | Agregar botón "Corte X" en la vista de caja (informe parcial mid-shift) |
| `GET /inventory/recepciones` | **Consumir** | Agregar historial de recepciones en InventarioView o como vista separada |
| `POST /inventory/vencimientos/verificar` | **Consumir** | Botón "Verificar vencidos" en LotesView |
| `GET /companies/my/sucursales` | **Crear en backend** | Reverse orphan — InventarioView lo llama pero no existe. Crear endpoint que retorne las sucursales del usuario autenticado. |
| `GET /suppliers/:id` | **Consumir** | Agregar vista de detalle de proveedor (o mantener solo lista) |
| `GET /users/:id` | **Consumir** | Agregar vista de perfil de usuario (o mantener solo lista) |
| `GET /categories/:id` | **Consumir** | Agregar vista de detalle de categoría con sus productos |
| `DELETE /users/:id` | **Eliminar** | Ya se usa soft delete vía `PATCH /users/:id { estaActivo }` |

**RBAC en sidebar:**

```typescript
// MainLayout.tsx — filtrar menú por rol del usuario
const menuItems = allItems.filter(item => 
  item.roles.includes(usuario.rol)
);
```

- **CAJERO:** POS, Clientes (búsqueda), Devoluciones
- **GERENTE:** + Inventario, Reportes, Dashboard, Proveedores
- **ADMIN:** + Usuarios, Categorías, Auditoría, Configuración

---

### D10 — Programa de Lealtad Configurable (añadido durante la implementación)

> **¿Por qué se hizo?** Durante la implementación de D5/D6 se detectó que el programa de lealtad
> quedó **hardcodeado**: umbrales fijos en `tier.util.ts` (bronce 100 / plata 500 / oro 1500 /
> platino 5000), sin descuentos por nivel, sin canje de puntos y sin posibilidad de apagarlo.
> El usuario solicitó que todo esto sea gestionable desde **"Configuración del sitio"** por parte
> del ADMIN/SUPER_ADMIN, con la mayor granularidad posible: habilitar/deshabilitar el programa,
> regla de asignación de puntos, rangos totalmente personalizados (nombre, umbral, descuento y
> color ilimitados), canje opcional y base de cálculo de puntos configurable. Adicionalmente se
> pidió que la información del cliente (puntos, rango, descuento) sea visible en ClientesView y
> en el POS. **Requisito transversal:** cada control de esta configuración debe llevar tooltips
> explicativos reutilizando el componente `AyudaTooltip` ya existente en `ConfiguracionView.tsx`.

**Decisiones de diseño (validadas con el usuario):**

| Decisión | Elección | Razón |
|----------|----------|-------|
| Modelo de rangos | Totalmente personalizados (tabla `NivelLealtad` dinámica) | El admin define cuántos rangos quiere, con nombre/umbral/descuento/color propios |
| Canje de puntos | Incluido, activable/desactivable desde configuración | El admin decide si el programa permite redención |
| Base de puntos | Configurable: sobre total con o sin descuento aplicado | El admin decide la política según su negocio |

**Schema (migración headless):**

```prisma
model ProgramaLealtad {
  id         String   @id @default(uuid())
  empresaId  String   @unique
  habilitado Boolean  @default(true)

  // Acumulación
  puntosPorMonto        Float      @default(10)   // cada $X gastados = 1 punto
  montoMinimoParaPuntos Float      @default(0)
  basePuntos            BasePuntos @default(CON_DESCUENTO)

  // Canje
  permitirCanje     Boolean @default(false)
  puntosPorPesos    Float   @default(100) // 100 pts = $1 canjeable
  canjeMinimoPuntos Int     @default(100)

  niveles NivelLealtad[]
}

enum BasePuntos { CON_DESCUENTO SIN_DESCUENTO }

model NivelLealtad {
  id           String  @id @default(uuid())
  programaId   String
  nombre       String
  umbralPuntos Int
  descuentoPct Float   @default(0)
  colorHex     String?
}
```

- `Cliente.tier` (enum `TierLealtad`) se **reemplaza** por `Cliente.nivelLealtadId String?`.
- La migración siembra 4 niveles default por empresa existente (Bronce 100/0%, Plata 500/3%,
  Oro 1500/5%, Platino 5000/10%) y mapea los tiers actuales de los clientes antes de eliminar
  la columna y el enum.

**Backend:**
- `customers/loyalty.util.ts`: `resolverNivel(puntos, niveles[])` (nivel con mayor umbral ≤ puntos,
  null = sin nivel) y `calcularPuntos(total, config)` respetando `basePuntos`. Sustituye a `tier.util.ts`.
- `sales.service.createSale`: carga config+niveles; si `habilitado=false` no acumula puntos ni aplica
  descuento/canje; aplica `venta.descuento` según el nivel del cliente; nuevo campo opcional
  `puntosACanjear` en `CrearVentaDto` validado contra `permitirCanje`, saldo de puntos y mínimo.
- `company-settings`: GET/PATCH extendidos con bloque `programaLealtad` (ADMIN/SUPER_ADMIN,
  reemplazo atómico de niveles, validación de umbrales ascendentes únicos y % 0–100) +
  endpoint `GET /company-settings/lealtad` accesible a **todos los roles autenticados**
  (CAJERO necesita leer la config en el POS).
- `customers.service`: detalle completo del cliente (puntos, nivel+color, descuento efectivo,
  cuenta crédito, últimas ventas) y filtro `estaActivo` para el selector del POS.

**Frontend:**
- `ConfiguracionView.tsx`: sección "Programa de Lealtad" — toggle general, regla de puntos,
  monto mínimo, base de puntos, canje (toggle + reglas), editor dinámico de niveles.
  **Todos los controles con `AyudaTooltip`.** Integrada al guard de cambios sin guardar.
- `ClientesView.tsx`: badges de nivel (color propio), puntos disponibles/históricos,
  % descuento, panel de detalle, acciones de crédito/abonos.
- `CheckoutModal.tsx` (POS): buscador de cliente, chip con nivel/puntos/descuento/saldo,
  línea de descuento automática y campo de canje cuando está habilitado.

---

### D11 — Promociones y Combos (Paquetes)

> **¿Por qué se hizo?** El catálogo solo permite vender productos sueltos; el comercio local
> necesita empaquetar productos para incentivar la compra conjunta. Las reglas de negocio
> (§4 de `REGLAS_NEGOCIO.md`) ya definen el modelo de paquetes/bundles, pero no existía
> implementación. El usuario solicitó un módulo para armar promociones/paquetes/combos con
> una interfaz intuitiva y poder venderlos sin fricción desde el POS.

**Decisiones de diseño (validadas con el usuario):**

| Decisión | Elección | Razón |
|----------|----------|-------|
| Alcance | Solo combos/paquetes | Valor acotado; descuentos 2x1/% por categoría quedan fuera (backlog) |
| Precio del combo | Precio fijo ($) o descuento % sobre la suma individual | El admin decide según su negocio |
| Venta en POS | Tarjeta de combo en catálogo + auto-detección en carrito | Ambas vías: proactiva y reactiva |
| Ticket | Combo como bloque (agregar/quitar el combo completo) | Simple y no rompe el precio |

**Schema (migración `add_combos`):**

```prisma
enum TipoPrecioCombo { MONTO_FIJO DESCUENTO_PCT }

model Combo {
  id            String            @id @default(uuid())
  empresaId     String
  nombre        String
  descripcion   String?
  tipoPrecio    TipoPrecioCombo   @default(MONTO_FIJO)
  valorPrecio   Float
  activo        Boolean           @default(true)
  fechaInicio   DateTime?
  fechaFin      DateTime?
  creadoPorId   String
  creadoEn      DateTime          @default(now())
  actualizadoEn DateTime          @updatedAt
  productos     ComboProducto[]
  detallesVenta DetalleVenta[]
  @@index([empresaId, activo])
}

model ComboProducto {
  id         String   @id @default(uuid())
  comboId    String
  productoId String
  cantidad   Float
  @@unique([comboId, productoId])
}
```

- `DetalleVenta` gana `comboId?` + `nombreCombo?` (snapshot) para trazabilidad en tickets/reportes.

**Backend:**

- Módulo `combos`: `GET /combos` (lista, incluye productos), `GET /combos/:id`,
  `POST /combos`, `PATCH /combos/:id`, `DELETE /combos/:id` (soft).
  RBAC: listar/consultar ADMIN/GERENTE/CAJERO; crear/editar/eliminar ADMIN/GERENTE.
- Validaciones: ≥1 producto con cantidad > 0, sin producto duplicado dentro del mismo combo,
  `MONTO_FIJO` exige `valorPrecio < Σ(precios individuales)` (debe existir ahorro),
  `DESCUENTO_PCT` acotado a 0–90, rango de fechas correcto.
- `sales.service.createSale` acepta `combos: [{comboId, cantidad}]`; el servidor **expande**
  los combos en líneas internas (precio calculado desde BD, ahorro repartido proporcionalmente)
  y las procesa con el loop estándar (inventario + lotes + `DetalleVenta` con `comboId`/`nombreCombo`).
  Las posiciones sueltas siguen existiendo; un producto puede coexistir suelto y en combo en el mismo ticket.

**Frontend (POS):**

- `usePosStore`: `CartItem` gana `comboId?`, `comboNombre?`, `grupoCombo?`; acciones `addCombo`,
  `removeComboGrupo`, `detectarCombosDisponibles`, `applyCombo(combo, K)`; cache de combos activos.
- Catálogo: chip "Combos" en `ProductSearch.tsx` + grid de `ComboCard.tsx`
  (precio del combo, suma individual, badge "Ahorras $X") + `ComboDetalleModal.tsx` (desglose + cantidad).
- Auto-detección: al cubrir el carrito el contenido de un combo vigente, se aplica automáticamente
  reemplazando las líneas sueltas por el bloque (lógica centralizada en `PosView.tsx` + `aplicarComboSugerido`).
- Ticket: `CartItem.tsx` agrupa por `grupoCombo` y renderiza el combo como bloque (stepper de bloque).
- Checkout: el payload envía `detalles` (sueltos) + `combos` agrupados; el servidor cobra precios autoritativos.

**Frontend (Admin):**

- `CombosView.tsx` (`/admin/combos`) estilo `CuponesView.tsx` + `ComboModalForm.tsx` con builder
  de items (buscador de productos + cantidad, suma individual y ahorro en vivo).
- Registro en `App.tsx` (ruta protegida ADMIN/GERENTE), `permisos.ts` (clave `combos`) y
  `MainLayout.tsx`.

**Backend (auditoría y consistencia — añadido en revisión):**

- El CRUD de combos queda bajo auditoría de la plataforma vía `AuditService` (mismo patrón que
  cupones/cajas): `COMBO_CREADO` (info), `COMBO_ACTUALIZADO` (info) y `COMBO_DESACTIVADO`
  (warning), con `entidadTipo: 'combo'`, `entidadId` y `detalles` (nombre, tipo de precio, valor,
  #productos, precios original/combo, ahorro, activo). `AuditoriaView` lista/filtra/muestra estas
  acciones con resumen legible.
- Detalle de venta (`findOneSale`): cada línea proveniente de un combo devuelve `comboId`,
  `nombreCombo` (snapshot), `descuento` y la relación `combo` (id, nombre, tipoPrecio, valorPrecio).
  `VentaDetalleView` muestra un badge "Combo: {nombre}" y la columna de descuento por línea.
- Sin campos muertos: `DetalleVenta.comboId`/`nombreCombo` pasan de solo-escritura a mostrarse;
  el `include` de producto del combo se recorta a lo consumido; tipos `Combo`/`ComboProducto` en
  `types/pos.ts` sin campos sin uso; se elimina el estado muerto `selectedCajaId` del `usePosStore`.

**Fuentes (tipografía):** todo CUDII usa solo los 3 tipos cargados en `index.html` (Geist,
JetBrains Mono, Material Symbols Outlined); los combos y sus integraciones reutilizan las
utilidades del sistema de diseño (`font-body-md`, `font-label-sm`, `font-mono`) sin fuentes
externas ni valores arbitrarios.

**Sidebar (composición por rol — verificado):** cada opción coincide con `permisos.ts`, el guard
de ruta de `App.tsx` y los `@Roles()` del backend. Se recompone el menú en secciones temáticas:
**Operaciones** (POS, Clientes, Fiados, Devoluciones, **Cajas Abiertas**), **Catálogo**
(Categorías, Productos), **Promociones** (Cupones, Combos — nueva sección), **Control de
Inventario** (Stock, Lotes, Proveedores), **Administración** (Usuarios, Auditoría, Configuración)
y **Análisis** (Reportes).

---

### D12 — Presupuestos (Cotizaciones al Cliente)

> **¿Por qué se hizo?** El cajero solo podía vender en el acto; no existía forma de **cotizar** a un
> cliente (registrado o no) un conjunto de productos/combos sin cobrar aún, con el precio
> **congelado** en el momento para poder **venderlos después por el ID del presupuesto** aunque el
> producto suba de precio. El comercio necesita presupuestar antes de la compra (el cliente decide,
> pedido por teléfono, apartados) y preservar la oferta ofrecida. El usuario solicitó: armar el
> presupuesto desde el ticket del POS (con descuentos por cliente y cupones aplicando), una
> **configuración** `conservarPrecioPresupuesto` (por empresa) que decida si al vender se conserva el
> precio congelado o se recalculan los precios actuales, y que sea **fácil vender según el ID del
> presupuesto** (cargarlo al ticket del POS y cobrar).

**Decisiones de diseño (validadas con el usuario):**

| Decisión | Elección | Razón |
|----------|----------|-------|
| Creación | Desde el ticket del POS ("Guardar como presupuesto" en el cobro) | Reutiliza el flujo/carrito existente; no duplica el picker de productos |
| Conversión a venta | **Cargar las líneas congeladas al ticket del POS y luego cobrar** | Reutiliza CheckoutModal completo (pagos, cupón, lealtad) |
| Precios congelados | Precio unitario **de productos y combos** al crearse | Conserva la oferta ofrecida aunque suba `precioVentaBase` |
| Revalidación al vender | Cupón y nivel/canje **se revalidan** contra el estado actual | Evita abusos (cupón caducado, límites, puntos); el descuento no congelado se recalcula |
| Config | `Empresa.conservarPrecioPresupuesto` (boolean, default `true`) y `Empresa.diasExpiracionPresupuesto` (int, default `0` = sin vencimiento) | La decide el ADMIN según su política comercial; la expiración limita cuántos días queda garantizado el precio congelado |
| Folio | Secuencial por empresa (`P-000001`), atómico | Buscable y único, independiente de la caja (no exige sesión abierta) |
| Requisito de caja | **No** exige sesión de caja abierta para crear/ver | Un presupuesto es pre-cobro; no toca `SesionCaja` ni inventario |
| Snapshots | `Presupuesto`/`PresupuestoDetalle` espejan `Venta`/`DetalleVenta` | Conversión fácilmente mapeable + trazabilidad del precio ofrecido |
| Refactor | Extraer cálculo de precios/descuentos de `SalesService` a helper compartido + soporte de "precios congelados" | Un solo motor de precios; presupuesto y venta jamás divergen |

**Schema (migración `add_presupuestos`):**

```prisma
enum EstadoPresupuesto { abierto vendido cancelado vencido }

model Presupuesto {
  id                    String   @id @default(uuid())
  empresaId             String
  empresa               Empresa  @relation(fields: [empresaId], references: [id])
  cajeroId              String
  cajero                Usuario  @relation(fields: [cajeroId], references: [id])
  clienteId             String?
  cliente               Cliente? @relation(fields: [clienteId], references: [id])

  folio          String // "P-000001"
  secuenciaFolio Int    // secuencial por empresa (Empresa.secuenciaPresupuesto)

  estado EstadoPresupuesto @default(abierto)

  // Desglose total (snapshot al crear)
  subtotal  Float
  descuento Float @default(0)
  impuestos Float @default(0)
  total     Float
  descuentoNivel Float @default(0)
  descuentoCanje Float @default(0)
  descuentoCupon Float @default(0)

  // Snapshots de contexto (no se consumen límites al crear)
  descuentoGeneral Float @default(0)
  codigoCupon       String?
  puntosACanjear    Int    @default(0)

  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt
  detalles PresupuestoDetalle[]

  @@unique([empresaId, folio])
  @@index([empresaId, creadoEn])
  @@index([empresaId, estado])
  @@index([clienteId])
}

model PresupuestoDetalle {
  id             String       @id @default(uuid())
  presupuestoId  String
  presupuesto    Presupuesto  @relation(fields: [presupuestoId], references: [id])
  productoId     String
  producto       Producto     @relation(fields: [productoId], references: [id])
  comboId        String?
  combo          Combo?       @relation(fields: [comboId], references: [id])
  nombreCombo    String?

  nombreProducto String // snapshot
  unidadMedida   String
  cantidad       Float
  precioUnitario Float // precio CONGELADO al crear
  descuento      Float @default(0) // p. ej. ahorro del combo repartido por línea
  subtotal       Float
  total          Float

  @@index([presupuestoId])
  @@index([productoId])
}
```

- `Empresa` gana `conservarPrecioPresupuesto Boolean @default(true)`, `secuenciaPresupuesto Int @default(0)` y `diasExpiracionPresupuesto Int @default(0)`.

**Comportamiento clave — "conservar precio" y revalidación:**

- Al **crear**: el servidor expande combos, valida productos/cupón/cliente (sin redimir cupón ni
  tocar inventario/sesión) y guarda el desglose como snapshot.
- Al **vender** (`POST /sales` con `presupuestoId`): si `conservarPrecioPresupuesto=true` usa el
  `precioUnitario` **congelado** de cada línea original (y su `descuento` por línea); si es `false`,
  recalcula desde el `precioVentaBase` actual. Cupón/nivel/canje **siempre se revalidan** (se
  recalculan `descuentoCupon`/`descuentoNivel`/`descuentoCanje` en la venta). El presupuesto pasa a
  `vendido` **dentro de la misma transacción** de la venta.
- Las líneas **nuevas/editadas** tras cargar un presupuesto usan el precio actual (los precios
  congelados solo aplican a los productos que estaban en el presupuesto).

**Backend:**

- Módulo `presupuestos` (controller/service/DTOs) registrado en `AppModule`:
  - `POST /presupuestos` (ADMIN/GERENTE/CAJERO) — `CrearPresupuestoDto` (`detalles[]`, `combos[]`,
    `clienteId?`, `descuentoGeneral?`, `codigoCupon?`, `puntosACanjear?`); sin `pagos`/`sesionCajaId`.
    Folio atómico por empresa.
  - `GET /presupuestos` (+CONTADOR) — paginado, filtros (estado, fecha, folio/cliente).
  - `GET /presupuestos/:id` — detalle con `precioCongelado`, `precioActual` y el `precioUnitario`
    efectivo según la config (lo que se carga al ticket).
  - `PATCH /presupuestos/:id/cancelar` (ADMIN/GERENTE) — `estado=cancelado`.
  - `PATCH /presupuestos/:id/descancelar` (ADMIN/GERENTE) — revierte `cancelado` → `abierto` (o `vencido` si venció estando cancelado); UI botón "Descancelar" en lista y detalle.
  - Job `PresupuestosExpiracionService` (`OnApplicationBootstrap` + `setInterval` 24 h) → `marcarVencidosGlobal()`; expone `diasExpiracionPresupuesto` y `fechaVencimiento` en lista y detalle.
- Refactor de `SalesService`: extraer el cálculo de precios/descuentos a un helper compartido;
  `CrearVentaDto` + `presupuestoId?`; `ItemDetalleVentaDto` + `comboId?`/`nombreCombo?`; soporte
  interno de `preciosCongelados` cuando la config lo habilita; marcado atómico `estado=vendido`.
  La venta sin `presupuestoId` conserva su comportamiento actual (re-precio desde catálogo).

**Frontend:**

- `usePosStore`: `presupuestoActivoId`, `setPresupuestoActivo` y `cargarPresupuesto(lineas, descuentoGeneral)`;
  `CartItem` gana `comboId?`/`nombreCombo?` para mostrar líneas de combo cargadas.
- `CheckoutModal`: botón **"Guardar como presupuesto"** (POST, muestra el folio, conserva el ticket)
  + envía `presupuestoId` en el payload de `/sales`.
- `PresupuestosView` (`/presupuestos`, ADMIN/GERENTE/CAJERO): lista paginada
  (folio/cliente/estado/fecha/total) + acciones **Vender** (carga al ticket → ir a `/pos`),
  **Ver detalle**, **Cancelar**.
- `ConfiguracionView`: sección **"Presupuestos"** con `<Switch>` `conservarPrecioPresupuesto` (`?? true`).
- Registro en `App.tsx`, `permisos.ts` (clave `presupuestos`, roles ADMIN/GERENTE/CAJERO) y
  `MainLayout.tsx` (sección Operaciones).

---

## Entregables

- [ ] Migración `cleanup_dead_fields` aplicada
- [ ] Migración `add_critical_indexes` aplicada (25+ índices)
- [ ] Route collisions resueltos (`notifications/mark-all-read`, `suppliers/:id/reactivate-status`)
- [ ] CORS restringido a `FRONTEND_URL`
- [ ] Paginación estandarizada en 5 endpoints (sales, notifications, audit, suppliers, inventory/lotes)
- [ ] 4 patrones N+1 corregidos (sales, returns, inventory, lotes.helper)
- [ ] Migración `add_clientes_credito_lealtad` aplicada
- [ ] `backend/src/modules/customers/` — módulo completo
- [ ] `backend/src/modules/reports/` — endpoints de los 5 reportes principales
- [ ] `backend/src/companies/` — endpoint `GET /companies/my/sucursales`
- [ ] `frontend/src/views/DashboardView.tsx` — dashboard con KPIs y gráficas reales
- [ ] `frontend/src/views/ClientesView.tsx` — CRUD de clientes
- [ ] `frontend/src/views/FiadosView.tsx` — gestión de crédito y abonos
- [ ] `frontend/src/views/ReportesView.tsx` — visualización de reportes con CSV
- [ ] DevolucionesView actualizado con historial (`GET /returns`)
- [ ] InventarioView actualizado con historial de recepciones
- [ ] RBAC en sidebar filtrado por rol
- [ ] Integración de `clienteId` en la terminal POS
- [ ] Acumulación de puntos al finalizar la venta
- [ ] D10: Migración `add_programa_lealtad_configurable` aplicada (siembra + mapeo de tiers)
- [ ] D10: Configuración de lealtad editable desde Configuración del sitio (con tooltips)
- [ ] D10: Descuento por nivel y canje de puntos operativos en ventas
- [ ] D10: Puntos/nivel/descuento visibles en ClientesView y en el POS
- [ ] D11: Migración `add_combos` aplicada (`Combo`, `ComboProducto`, `DetalleVenta.comboId`/`nombreCombo`)
- [ ] D11: Módulo backend `combos` (CRUD + RBAC + validaciones) registrado en `AppModule`
- [ ] D11: Integración en `POST /sales` (expansión server-side con precios autoritativos)
- [ ] D11: POS — chip/grid de combos + `ComboDetalleModal` + auto-aplicación en carrito (auto-detección)
- [ ] D11: Ticket — combo como bloque (agrupar/stepper/eliminar)
- [ ] D11: Admin — `CombosView` + `ComboModalForm` con builder de items y ahorro en vivo
- [ ] D11: Rutas/permisos/menú configurados para combos
- [ ] D11: Auditoría de combos (`COMBO_CREADO`/`ACTUALIZADO`/`DESACTIVADO`) visible en `AuditoriaView`
- [ ] D11: Detalle de venta muestra el combo aplicado (badge + descuento por línea)
- [ ] D11: Sin campos muertos en combos (tipos, store, includes)
- [ ] D11: Fuentes verificadas — solo Geist / JetBrains Mono / Material Symbols en todo CUDII
- [ ] D11: Sidebar recomposado en secciones temáticas y filtrado por rol (cajas → Operaciones, Promociones nueva)
- [x] D12: Migración `add_presupuestos` aplicada (`Presupuesto`, `PresupuestoDetalle`, `Empresa.conservarPrecioPresupuesto`, `Empresa.secuenciaPresupuesto`)
- [x] D12: Refactor de `SalesService` — helper compartido de precios/descuentos + soporte `presupuestoId`/`preciosCongelados`
- [x] D12: Módulo backend `presupuestos` (create/list/detail/cancelar) registrado en `AppModule`
- [x] D12: `CrearVentaDto` + `presupuestoId` y `ItemDetalleVentaDto` + `comboId`/`nombreCombo`
- [x] D12: POS — botón "Guardar como presupuesto" + envío de `presupuestoId` en `/sales`
- [x] D12: `usePosStore.cargarPresupuesto` + `presupuestoActivoId` + `CartItem.comboId`/`nombreCombo`
- [x] D12: `PresupuestosView` (lista/detalle/vender/cancelar) + ruta + permisos + menú
- [x] D12: `ConfiguracionView` — switch `conservarPrecioPresupuesto`
- [x] D12: Migración `20260831000000_add_dias_expiracion_presupuesto` aplicada (`Empresa.diasExpiracionPresupuesto`, `EstadoPresupuesto.vencido`)
- [x] D12: Expiración — config `diasExpiracionPresupuesto` en `GET/PATCH /company-settings`, marcado `vencido` perezoso al listar/detalle **y** job `PresupuestosExpiracionService` (`marcarVencidosGlobal`), precio recalculado al vigente al vencer, `fechaVencimiento`/`precioVencido` expuestos
- [x] D12: `PATCH /presupuestos/:id/descancelar` (cancelado→abierto o vencido) + auditoría `PRESUPUESTO_DESCANCELADO`
- [x] D12: Frontend expiración/descancelar — badge/filtro estado `vencido`, "Vence/Vencía el" en lista/detalle, acciones Vender/Cancelar en vencido, botón "Reactivar", aviso de precio recalculado y rediseño del modal de detalle
- [x] D12: Frontend ticket — grupos de combo expandibles para líneas de presupuesto + indicador de cambio de precio por línea (`Cotizado X → actual Y, se cobra Z`)
- [x] D13: `Empresa.configuracionTicket` — personalización de tickets (Ventas y Presupuestos) con servidor estático multitenant `/uploads/` y limpieza de logos huérfanos
- [x] D14: Módulo backend `solicitudes-proveedor` (CRUD + RBAC + estados) registrado en `AppModule` + `SolicitudesProveedorView`/`SolicitudProveedorPrintModal` + buscador global
- [x] D15: Migración `20260907000000_add_traspasos_egresos_grn` aplicada (`EgresoCaja`, `CategoriaEgresoCaja`, `Traspaso`, `TraspasoDetalle`, `EstadoTraspaso`, `SesionCaja/CorteX/CorteZ.totalEgresos`, `RecepcionMercancia.solicitudProveedorId`, `TipoMovimientoInventario.ENTRADA_COMPRA/SALIDA_TRASPASO/ENTRADA_TRASPASO`)
- [x] D15: Módulo `solicitudes-proveedor` — `POST /:id/recibir` (GRN) que crea `RecepcionMercancia` + lotes con caducidad, incrementa `InventarioSucursal.stockActual` y registra `ENTRADA_COMPRA` con costo real, en transacción
- [x] D15: `RecibirSolicitudProveedorModal` (cantidades, costo real, lote, vencimiento, factura) + botón "Recibir GRN" en `SolicitudesProveedorView`
- [x] D16: Módulo backend `traspasos` (create/list/detalle/recibir) con folios atómicos `TRASP-000001` (`Empresa.secuenciaTraspaso`) y estados `BORRADOR`/`EN_TRANSITO`/`RECIBIDO`/`RECIBIDO_PARCIAL`/`CANCELADO`
- [x] D16: Emisión decrementa stock origen + `SALIDA_TRASPASO`; recepción (aun parcial) incrementa stock destino + `ENTRADA_TRASPASO`; auditoría `TRASPASO_CREADO`/`TRASPASO_RECIBIDO`
- [x] D16: Frontend — `TraspasosView` (lista paginada con filtros) + `NuevoTraspasoModal` + `RecibirTraspasoModal` + ruta/per-misos/menú/buscador
- [x] D17: `POST /cash-register/expenses` — validación de sesión `ABIERTA` y efectivo disponible (`Inicial + Ventas − Retiros − Egresos`), `totalEgresos` atómico en `SesionCaja`, incluido en Corte X/Z + auditoría `EGRESO_CAJA_REGISTRADO`
- [x] D17: Frontend — `RegistrarEgresoModal` en el POS (categorías FLETE/LIMPIEZA/INSUMOS/PROPINAS/OTROS) + botón en `PosView` + arqueo con egresos en `CloseRegisterModal`
- [x] D18: `ImpresionEtiquetasModal` — diseñador dinámico de etiquetas (58mm/80mm/A4 stickers), elementos on/off, códigos de barras y `@media print` + botón en `ProductosView`
- [x] D19: `CameraBarcodeScannerModal` — Web API `BarcodeDetector` con fallback a canvas, cámara trasera en modo environment, flash/linterna y beep + ícono de cámara en `ProductSearch`

---

## Validaciones

### Pruebas funcionales
1. Crear cliente `Juan Pérez` con teléfono y email.
2. Abrir cuenta de crédito con límite $2,000.
3. Realizar una venta a crédito de $500 → verificar `VentaCredito` creada, `saldoPendiente: 500`.
4. Intentar venta a crédito de $2,000 con saldo pendiente de $500 (superaría el límite) → sistema rechaza.
5. Registrar abono de $300 → `saldoPendiente` queda en $200; estado `parcialmente_pagada`.
6. El Dashboard muestra las ventas del día correctamente.
7. `GET /reports/sales-summary?fechaInicio=hoy` → devuelve el resumen correcto.
8. `GET /reports/inventory` → muestra los productos con stock bajo correctamente.
9. `GET /sales?page=1&limit=10` → respuesta con formato `{ data, meta }` consistente.
10. DevolucionesView muestra historial de devoluciones previas.
11. Un usuario CAJERO no ve Usuarios ni Auditoría en el sidebar.
12. D10: Configurar nivel "Oro" con 5% de descuento → venta de $1,000 a cliente Oro aplica $50 de descuento.
13. D10: Deshabilitar el programa en Configuración → nuevas ventas no acumulan puntos ni descuentos.
14. D10: Canje habilitado con mínimo 100 pts → cliente con 250 pts canjea 200 pts ($2) y su saldo queda en 50.
15. D11: Crear combo "Soda + Papas" con precio fijo $89 (suma individual $103) → ahorro $14.
16. D11: Crear combo con descuento 20% → precio = Σ individual × 0.8.
17. D11: Rechazar combo `MONTO_FIJO` con precio ≥ suma individual.
18. D11: Venta con combo → `DetalleVenta.comboId` poblado y stock decrementado por cada producto del combo.
19. D11: POS — agregar combo desde catálogo → aparece como bloque en el ticket.
20. D11: POS — con Soda + Papas ya sueltos en el carrito → el combo se auto-aplica y el ahorro se refleja.
21. D11: Crear/actualizar/desactivar un combo → se registra en Auditoría (`COMBO_CREADO`/`ACTUALIZADO`/`DESACTIVADO`) con su resumen y se ve en `AuditoriaView`.
22. D11: Venta con combo → el detalle de venta muestra el badge "Combo" y el descuento por línea.
23. D12: [x] Armar un presupuesto desde el POS con un producto suelto ($50) y un combo → se crea con folio P-000001 y total congelado; **NO descuenta inventario ni exige sesión de caja**. *(E2E 14.1–14.3)*
24. D12: Subir `precioVentaBase` del producto a $60 → con `conservarPrecioPresupuesto=true`, "Vender" por ID del presupuesto cobra $50 (precio congelado).
25. D12: Con `conservarPrecioPresupuesto=false`, la misma venta cobra $60 (precio actual).
26. D12: Presupuesto con cupón vencido → al vender se rechaza/revalida (no hereda el descuento vencido) y el presupuesto no queda `vendido`.
27. D12: [x] Al completar la venta del presupuesto, su estado pasa a `vendido` en la misma transacción; no se puede vender dos veces (rechazo). *(E2E 14.7–14.8, 14.10)*
28. D12: [x] Cancelar un presupuesto → `estado=cancelado`; no aparece como vendible. *(E2E 14.9)*
29. D12: Un presupuesto con cliente registrado aplica el descuento por nivel/canje al momento de crear y lo revalida al vender.
30. D12: [x] Con `diasExpiracionPresupuesto` (>0) configurado, un presupuesto abierto que supera esa ventana se marca automáticamente `vencido` (por marcado perezoso **y** por el job en segundo plano `PresupuestosExpiracionService`, análogo a las caducidades), su `precioEfectivo` se recalcula al precio vigente del catálogo y se filtra por estado `vencido`; la lista y el detalle muestran la **fecha de vencimiento** (`fechaVencimiento`/`diasExpiracionPresupuesto`) solo cuando aplica. *(E2E 15.1–15.7)*

### Pruebas de performance
1. Venta con 10+ items → verificar que no se ejecutan más de 20 queries (vs 80+ actual).
2. `GET /sales` con 10,000 registros → respuesta en < 200ms gracias a los índices.
3. `GET /inventory/lotes` con lotes vencidos → no genera N+1 queries.

---

## Criterios de Salida

- [ ] El schema no tiene campos sin uso (zero dead fields).
- [ ] Todas las FKs críticas tienen `@@index`.
- [ ] No hay route collisions — los 2 endpoints renombrados responden correctamente.
- [ ] La paginación es consistente en todos los módulos: mismo formato, mismos query params.
- [ ] Una venta con 10 items ejecuta < 25 queries (vs 80+ actual).
- [ ] El CRUD de clientes funciona desde el frontend.
- [ ] Las ventas a crédito crean la deuda y descuentan el límite disponible.
- [ ] Los abonos reducen el saldo correctamente en orden FIFO.
- [ ] La acumulación de puntos funciona al completar ventas.
- [ ] El Dashboard muestra métricas reales (no datos hardcodeados).
- [ ] Los 5 reportes principales están disponibles y el formato CSV funciona.
- [ ] Los 9 endpoints huérfanos están consumidos o eliminados.
- [ ] El sidebar muestra menú filtrado por el rol del usuario.
- [ ] D11: Los combos se crean/editan desde el frontend con validación de ahorro positivo.
- [ ] D11: La venta con combo genera `DetalleVenta.comboId` y descuenta inventario por producto.
- [ ] D11: El POS permite vender combos por catálogo y por auto-detección (bloque).
- [ ] D11: El ahorro del combo se refleja en el desglose del ticket y del cobro.
- [x] D12: Los presupuestos se crean desde el POS sin requerir sesión de caja ni tocar inventario.
- [x] D12: "Vender por ID" carga el presupuesto al ticket y respeta `conservarPrecioPresupuesto` (congelado vs actual).
- [x] D12: La venta de un presupuesto lo marca `vendido` atómicamente; los duplicados se rechazan.
- [x] D12: Configuración `conservarPrecioPresupuesto` visible/editable y aplicada por la empresa.
- [x] D12: Un presupuesto que supera `diasExpiracionPresupuesto` se marca `vencido` y su `precioEfectivo` se recalcula al vigente del catálogo; la lista/detalle muestran `fechaVencimiento`; se puede vender/cancelar a precio vigente.
- [x] D12: Un presupuesto cancelado puede descancelarse (vuelve a `abierto`, o `vencido` si venció estando cancelado).
- [x] D13: Configuración completa de estilo y personalización de tickets (Ventas y Presupuestos) almacenada en `Empresa.configuracionTicket`.
- [x] D13: Servidor de archivos estáticos `/uploads/` en NestJS con aislamiento multitenant por subcarpeta `uploads/logos/empresa_<empresaId>/`.
- [x] D13: Captura de espacio en disco lleno (`ENOSPC`) respondiendo mensaje estandarizado: *"En este momento no podemos subir el archivo debido al espacio insuficiente."*.
- [x] D13: Política de limpieza de archivos huérfanos: eliminación automática de logos anteriores no utilizados de la empresa al subir un nuevo archivo o remover el actual.
- [x] D13: Formateo avanzado de texto (`negrita`, `subrayado`, `alineacion`), tooltips informativos y omisión estricta de campos vacíos en comprobantes e impresión.
- [x] D15: Al recibir una solicitud de proveedor, el inventario de la sucursal se incrementa en la misma transacción, los lotes con caducidad quedan registrados y el movimiento `ENTRADA_COMPRA` se registra con costo real; la solicitud queda `RECIBIDA`/`RECIBIDA_PARCIAL`.
- [x] D16: Un traspaso emitido decrementa el stock origen (SALIDA_TRASPASO); al recibirse incrementa el destino (ENTRADA_TRASPASO); la recepción parcial se soporta y registra observaciones.
- [x] D17: Un egreso solo se registra con sesión `ABIERTA` y no excede el efectivo disponible; el esperado del Corte X/Z es `Inicial + Ventas − Retiros − Egresos`.
- [x] D18: La impresión de etiquetas permite elegir formato, alternar elementos y generar códigos de barras imprimibles por `@media print`.
- [x] D19: La cámara del dispositivo escanea códigos de barras y agrega productos al ticket del POS.

---

### D13 — Estilo, Personalización y Patrón Estándar de Almacenamiento de Archivos

#### 1. Arquitectura de Almacenamiento Estático y Multitenancy
Para seguir las mejores prácticas de software empresarial y evitar sobrecargar la base de datos PostgreSQL, los archivos binarios (logos, comprobantes) se almacenan en el sistema de archivos local (`/uploads/`) y solo se guardan URLs relativas en la base de datos (`/uploads/logos/empresa_<empresaId>/filename.png`).

- **Aislamiento Multitenant:** Cada empresa dispone de su propio subdirectorio aislado: `uploads/logos/empresa_<empresaId>/`.
- **Servidor Estático:** NestJS expone la carpeta estática mediante `app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' })`.
- **Manejo de Espacio en Disco (`ENOSPC`):** Al fallar la escritura por almacenamiento lleno o error de disco, el controlador captura el error y responde con el mensaje estandarizado:
  > *"En este momento no podemos subir el archivo debido al espacio insuficiente."*
- **Política de Limpieza Automática:** El método `limpiarArchivosLogoNoUsados(empresaId, urlLogoActual)` escanea el directorio de la empresa y elimina cualquier archivo antiguo de logo que ya no esté referenciado en la configuración activa.

#### 2. Configuración y Formateo Avanzado de Tickets
La estructura Json `Empresa.configuracionTicket` define los estilos tanto para el Ticket de Venta como para el Ticket de Presupuesto:

```ts
export interface EstiloTexto {
  negrita?: boolean;
  subrayado?: boolean;
  alineacion?: 'left' | 'center' | 'right';
}

export interface ConfigTicketVenta {
  mostrarLogo: boolean;
  logoUrl?: string;
  encabezado: string;
  estiloEncabezado?: EstiloTexto;
  slogan?: string;
  estiloSlogan?: EstiloTexto;
  direccion?: string;
  telefono?: string;
  rfc?: string;
  email?: string;
  estiloContacto?: EstiloTexto;
  mostrarCajero: boolean;
  mostrarCliente: boolean;
  mostrarFechaHora: boolean;
  mostrarImpuestos: boolean;
  mostrarDesglosePagos: boolean;
  mensajePie: string;
  estiloPie?: EstiloTexto;
  anchoMm: '80mm' | '58mm';
  tamanoFuente: 'pequena' | 'normal' | 'grande';
}
```

#### 3. Regla de Omisión Estricta de Campos Vacíos
Cualquier campo de texto (dirección, teléfono, RFC, slogan, pie) que se encuentre vacío o contenga únicamente espacios en blanco (`!val?.trim()`) es ignorado automáticamente durante la renderización e impresión del comprobante, garantizando tickets limpios sin saltos de línea innecesarios.

---

### D14: Módulo de Solicitud de Productos a Proveedores y Requisiciones (V1.5)

#### 1. Propósito y Alcance Operativo
El módulo de **Solicitud de Productos a Proveedores** (Órdenes de Compra y Requisiciones de Surtido) permite al personal de administración, almacén y gerencia generar solicitudes estructuradas de productos hacia proveedores registrados o como **requisiciones internas abiertas** (`proveedorId` opcional).

- **Gestión de Ciclo de Vida:**
  - `BORRADOR`: Solicitud en preparación (editable en renglones y eliminable).
  - `ENVIADA`: Requisición emitida formalmente para surtido.
  - `RECIBIDA`: Mercancía confirmada al ingresar al inventario de almacén.
  - `CANCELADA`: Solicitud anulada.

- **Generación Atómica de Folios:**
  Cada empresa mantiene una secuencia independiente `secuenciaSolicitudProveedor` que genera folios del tipo `SOL-000001`, `SOL-000002` mediante operaciones de incremento atómico en PostgreSQL.

- **Impresión y Exportación Formal:**
  Generación e impresión limpia mediante `@media print` de comprobantes corporativos tipo orden de compra empresarial, incluyendo datos de la empresa, logo, datos del proveedor destinatario, desglose de ítems con costo unitario estimado, notas por línea y firmas de recepción. Asimismo, incluye la funcionalidad de copia formateada para envíos rápidos vía WhatsApp/Email.

#### 2. Modelo de Datos y Esquema Prisma
```prisma
enum EstadoSolicitudProveedor {
  BORRADOR
  ENVIADA
  RECIBIDA
  CANCELADA
}

model SolicitudProveedor {
  id           String                   @id @default(uuid())
  empresaId    String
  empresa      Empresa                  @relation(fields: [empresaId], references: [id])
  proveedorId  String?                  // Opcional: null = Solicitud Abierta / Requisición Interna
  proveedor    Proveedor?               @relation(fields: [proveedorId], references: [id])
  creadoPorId  String
  creadoPor    Usuario                  @relation("solicitudesProveedorCreadas", fields: [creadoPorId], references: [id])

  folio        String                   // Ej: "SOL-000001"
  estado       EstadoSolicitudProveedor @default(BORRADOR)
  fechaEmision DateTime                 @default(now())
  fechaEntregaEsperada DateTime?
  notas        String?
  totalEstimado Float                   @default(0)

  creadoEn     DateTime                 @default(now())
  actualizadoEn DateTime                @updatedAt

  detalles     SolicitudProveedorDetalle[]
}

model SolicitudProveedorDetalle {
  id                   String             @id @default(uuid())
  solicitudProveedorId String
  solicitudProveedor   SolicitudProveedor @relation(fields: [solicitudProveedorId], references: [id], onDelete: Cascade)
  productoId           String
  producto             Producto           @relation(fields: [productoId], references: [id])

  nombreProducto       String             // Snapshot del nombre del producto
  unidadMedida         String             @default("pieza")
  cantidadRequerida    Float
  costoUnitarioEstimado Float             @default(0)
  subtotalEstimado     Float              @default(0)
  notas                String?
}
```

#### 3. Auditoría de Movimientos y Registro de Logs (`LogActividad`)
Todas las operaciones realizadas por los usuarios son registradas automáticamente por `SolicitudesProveedorService` mediante el servicio centralizado `AuditService`:
- `SOLICITUD_PROVEEDOR_CREADA`: Registra folio, proveedor destinatario (o solicitud abierta), costo total estimado y cantidad de ítems.
- `SOLICITUD_PROVEEDOR_ACTUALIZADA`: Registra cambios en notas, ítems o fechas.
- `SOLICITUD_PROVEEDOR_ESTADO_CAMBIADO`: Registra el cambio de estado (ej: de `BORRADOR` a `ENVIADA` o `RECIBIDA`).
- `SOLICITUD_PROVEEDOR_ELIMINADA`: Registra la eliminación de borradores con severidad `warning`.

Todos estos eventos son visibles en el módulo de **Auditoría** (`/admin/auditoria`), permitiendo filtrar por usuario, tipo de acción y rango de fechas con resúmenes detallados.

---

### D15: Convertir Requisición en Recepción de Mercancía (GRN - Goods Received Note)

#### 1. Propósito y Alcance Operativo
El módulo de **Recepción de Mercancía (GRN)** completa el ciclo de abastecimiento conectando una **Solicitud de Productos a Proveedores** (`SolicitudProveedor`) o una entrada directa con la **actualización real del inventario** en el almacén de la sucursal.

- **¿Por qué?** Una solicitud formal a un proveedor o requisición interna no debe quedar únicamente como un documento en papel o borrador, sino que debe reflejarse en las existencias reales cuando llega la mercancía física.
- **¿Para qué?** Para incrementar el `stockActual` en `InventarioSucursal`, dar de alta los lotes recibidos con sus respectivas fechas de caducidad (política FEFO/FIFO), registrar el número de factura/remisión del proveedor y registrar el movimiento de inventario `ENTRADA_COMPRA` con costo unitario real.
- **¿Cómo?** Endpoint `POST /solicitudes-proveedor/:id/recibir` (o recepción directa) que procesa dentro de una transacción de PostgreSQL:
  1. Validación de cantidades recibidas por renglón (soporta recepción parcial o completa).
  2. Creación o actualización de registros `Lote` (número de lote y fecha de vencimiento).
  3. Incremento atómico en `InventarioSucursal.stockActual`.
  4. Generación de `MovimientoInventario` con tipo `ENTRADA_COMPRA` y costo real.
  5. Actualización del estado de `SolicitudProveedor` a `RECIBIDA` o `RECIBIDA_PARCIAL`.
  6. Registro de evento de auditoría `REQUISICION_RECIBIDA_INVENTARIO` en `LogActividad`.

---

### D16: Traspasos de Inventario entre Sucursales (Branch Transfers)

#### 1. Propósito y Alcance Operativo
El módulo de **Traspasos de Inventario entre Sucursales** habilita la movilización de mercancía entre diferentes sucursales o almacenes de la misma empresa con control y trazabilidad en dos fases.

- **¿Por qué?** En operaciones multi-sucursal, mover productos de un almacén central a una tienda secundaria sin un registro formal genera descuadres invisibles y pérdidas no rastreables.
- **¿Para qué?** Para garantizar la consistencia del inventario mientras la mercancía está físicamente "en tránsito" entre sucursal origen y sucursal destino.
- **¿Cómo?**
  - **Esquema de BD:** Modelos `Traspaso` y `TraspasoDetalle` con folios atómicos del tipo `TRASP-000001`, sucursal origen, sucursal destino, usuario emisor y usuario receptor.
  - **Flujo de Ciclo de Vida:**
    1. `BORRADOR`: Traspaso en preparación.
    2. `EN_TRANSITO`: Al emitir la salida, el backend decrementar el stock en la sucursal origen y genera un `MovimientoInventario` de tipo `SALIDA_TRASPASO`.
    3. `RECIBIDO`: Al llegar a la sucursal destino, el usuario receptor valida las cantidades físicamente recibidas, incrementa el stock en la sucursal destino y genera un `MovimientoInventario` de tipo `ENTRADA_TRASPASO`. Si existen diferencias, se marca como `RECIBIDO_PARCIAL` con observaciones.
    4. `CANCELADO`: Reversión del traspaso antes de ser recibido.
  - **Auditoría:** Registro automático de eventos `TRASPASO_CREADO`, `TRASPASO_ENVIADO`, `TRASPASO_RECIBIDO` y `TRASPASO_CANCELADO`.

---

### D17: Registro de Egresos / Gastos Directos de Caja

#### 1. Propósito y Alcance Operativo
El módulo de **Egresos y Gastos Directos de Caja** permite al cajero registrar salidas de dinero en efectivo de la caja activa para cubrir gastos operativos menores del turno (flete, propinas de reparto, compra de insumos de limpieza, papelería de emergencia).

- **¿Por qué?** Cuando un cajero toma dinero del cajón para pagar un gasto operativo y no existe un registro formal en el sistema, al final del turno en el `Corte X` o `Corte Z` la caja reporta un faltante artificial no justificado.
- **¿Para qué?** Para mantener un arqueo exacto de efectivo en tiempo real y justificar contablemente cada salida de dinero sin confundirla con retiros de valores hacia caja fuerte o banco.
- **¿Cómo?**
  - **Esquema de BD:** Modelo `EgresoCaja` vinculado a la `SesionCaja` activa (`sesionCajaId`, `usuarioId`, `monto`, `categoria` [FLETE, LIMPIEZA, INSUMOS, OTROS], `concepto`, `comprobanteUrl?`, `fechaHora`).
  - **Reglas de Negocio:**
    1. Solo se permite registrar egresos en sesiones de caja con estado `ABIERTA`.
    2. El monto del egreso debe ser menor o igual al efectivo disponible calculado en la sesión.
    3. En el cierre de caja (`Corte X` y `Corte Z`), el resumen financiero aplica la fórmula autoritativa:
       $$\text{Efectivo Esperado} = \text{Monto Inicial} + \text{Ventas Efectivo} - \text{Retiros Parciales} - \text{Egresos Directos}$$
  - **Auditoría:** Registro automatizado de eventos `EGRESO_CAJA_REGISTRADO` en `LogActividad`.

---

### D18: Impresión Masiva de Etiquetas y Códigos de Barras

#### 1. Propósito y Alcance Operativo
El módulo de **Impresión Masiva de Etiquetas y Códigos de Barras** provee un diseñador dinámico e impresor especializado para productos, combos y lotes.

- **¿Por qué?** Muchos comercios re-empacan mercancía a granel, elaboran combos propios o manejan productos sin código de barras de fábrica, dificultando el cobro rápido en la terminal POS.
- **¿Para qué?** Permitir la generación instantánea e impresión en lote de etiquetas adhesivas para anaquel o empaque con códigos de barras EAN-13/Code-128 o códigos QR.
- **¿Cómo?**
  - **Frontend:** Vista/Modal de herramientas de etiquetado con buscador dinámico de catálogo o importación directa desde una recepción de compra / orden a proveedor.
  - **Diseñador de Etiquetas:** Configuración en vivo del tamaño de la etiqueta (58mm, 80mm, planchas de stickers A4/Avery), toggle de elementos visibles (Nombre, Precio de venta, Código de barras, Código QR, SKU, Lote/Caducidad, Logotipo de la empresa).
  - **Motor de Renderizado e Impresión:** Generación de simbología en SVG/Canvas mediante librerías nativas JavaScript (`jsbarcode`, `qrcode`) y formateo CSS `@media print` optimizado para impresoras térmicas de etiquetas (Zebra, Xprinter, Godex, TSC) y mini-printers térmicas.

---

### D19: Lector de Código de Barras con Cámara del Celular / Web

#### 1. Propósito y Alcance Operativo
El módulo de **Lector por Cámara** transforma la cámara integrada de cualquier smartphone, tablet o laptop en un escáner de código de barras omnidireccional de alta velocidad.

- **¿Por qué?** Pequeños comercios o empleados en almacén no siempre cuentan con un escáner láser USB o Bluetooth físico a la mano.
- **¿Para qué?** Facilitar la búsqueda e incorporación inmediata de productos al carrito del POS, el escaneo en recepción de mercancía y la toma de inventarios directamente desde dispositivos móviles.
- **¿Cómo?**
  - **Tecnología Frontend:** Componente reutilizable `CameraBarcodeScanner` que implementa la Web API nativa `BarcodeDetector` (aceleración por hardware en navegadores móviles/modernos) con fallback automático transparente a motor JavaScript (`ZXing` / `html5-qrcode`).
  - **Integración Transversal:**
    1. Terminal POS (`ProductSearch.tsx`): Ícono de cámara para escanear y agregar directo al ticket.
    2. Catálogo de Productos (`ProductoModalForm.tsx`): Captura rápida del código de barras físico al dar de alta un producto.
    3. Inventarios y Recepciones: Escaneo en almacén para conteos físicos.
  - **Experiencia de Usuario (UX):** Selección de cámara trasera (`facingMode: environment`), control de flash/linterna (cuando está disponible por hardware) y señal sonora opcional (beeping de confirmación).

---

## Pre-Producción (checklist, NO parte de los sprints)

> Estas tareas se ejecutan SOLO antes de desplegar a producción. No están incluidas en los sprints de desarrollo.

- [ ] Rotar secrets: generar nuevos valores para `JWT_SECRET`, contraseña de BD, y cualquier otro secreto hardcodeado en `.env`
- [ ] Mover credenciales a variables de entorno seguras del servidor (no `.env` en el repo)
- [ ] Verificar que `.env` está en `.gitignore` y no se ha committed con secretos
- [ ] Auditar CORS restringido a dominio de producción exacto
- [ ] Verificar permisos RBAC en todos los endpoints (no hay endpoints sin proteger)
- [ ] Revisar logs no expone información sensible (passwords, tokens)
- [ ] Configurar rate limiting más restrictivo para producción

---

## Dependencias para la Fase 5

| Artefacto producido | Cómo lo usa Fase 5 |
|--------------------|-------------------|
| Módulo `reports` con endpoints de datos de negocio | La IA conversacional de Fase 5 consulta estos mismos endpoints para responder preguntas |
| Modelo `Cliente` y `VentaCredito` | El módulo de notificaciones de Fase 5 envía alertas cuando se acerca el vencimiento de una deuda |
| `InventarioSucursal` con `stockActual` y `stockMinimo` | El módulo de compras de Fase 5 detecta automáticamente los productos que necesitan reabastecimiento |
| Estructura de DTOs y endpoints documentada | La migración asistida de Fase 5 importa clientes y productos usando los mismos módulos |
| Paginación estandarizada | La IA y los reportes de Fase 5 usan el mismo formato consistente |
| Endpoint `GET /companies/my/sucursales` | El módulo de importación de Fase 5 lo usa para filtrar por sucursal |
| Modelo `Combo` y `DetalleVenta.comboId` | La IA de sugerencias de Fase 5 usa las asociaciones reales vendidas como combo para proponer promociones |
| Modelo `Presupuesto` y `PresupuestoDetalle` | La IA y el módulo de apartados/seguimiento de Fase 5 detectan presupuestos abiertos para reactivarlos y ofrecer descuentos |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El cálculo del tier de lealtad se vuelve inconsistente si hay abonos y cancelaciones | Recalcular el tier en un job asíncrono semanal en lugar de en cada transacción |
| Las ventas a crédito quedan sin pagar y el límite se satura | Agregar alerta automática cuando el cliente supera el 80% de su límite |
| Los reportes son lentos con mucho volumen de datos | Los índices de D1 resuelven esto; agregar paginación en reportes si superan 1000 registros |
| El dashboard se recarga con polling y consume mucha batería en tablets táctiles | Usar SSE (Server-Sent Events) para actualizaciones en lugar de polling agresivo |
| Fix de N+1 rompe la lógica de negocio existente | Ejecutar tests existentes (53/53) después de cada cambio; comparar resultados de ventas de prueba antes/después |
| La paginación en español→inglés rompe el frontend | Actualizar todos los consumidores frontend en el mismo commit que el backend |
| El ahorro del combo se duplica al combinar con cupones/lealtad | El descuento del combo forma parte del `descuentoVenta` base; cupón/nivel aplican sobre la base restante (cascada existente no cambia) |
| Precios desactualizados si cambia `precioVentaBase` después de crear el combo | El precio del combo siempre se recalcula desde BD al vender; el ahorro de catálogo es informativo |
| Combo con producto sin stock en la sucursal | Se mantiene la política permisiva auditada (stock negativo), igual que los productos sueltos |
| La venta de un presupuesto conserva el precio pero el inventario/método de pago actual difiere | La revalidación de cupón/nivel al vender + el marcado atómico `vendido` evitan vender dos veces; los precios congelados solo aplican a los productos originales |
| El refactor del motor de precios rompe la venta normal | Ejecutar E2E (53/53) tras el refactor; la venta sin `presupuestoId` conserva su comportamiento actual (re-precio desde catálogo) |
| Ambigüedad "conservar o no" para una venta puntual | La config es por empresa; (opcional futuro) override por presupuesto como mejora |
