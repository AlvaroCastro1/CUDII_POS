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

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El cálculo del tier de lealtad se vuelve inconsistente si hay abonos y cancelaciones | Recalcular el tier en un job asíncrono semanal en lugar de en cada transacción |
| Las ventas a crédito quedan sin pagar y el límite se satura | Agregar alerta automática cuando el cliente supera el 80% de su límite |
| Los reportes son lentos con mucho volumen de datos | Los índices de D1 resuelven esto; agregar paginación en reportes si superan 1000 registros |
| El dashboard se recarga con polling y consume mucha batería en tablets táctiles | Usar SSE (Server-Sent Events) para actualizaciones en lugar de polling agresivo |
| Fix de N+1 rompe la lógica de negocio existente | Ejecutar tests existentes (39/39) después de cada cambio; comparar resultados de ventas de prueba antes/después |
| La paginación en español→inglés rompe el frontend | Actualizar todos los consumidores frontend en el mismo commit que el backend |
