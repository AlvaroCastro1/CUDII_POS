# Auditoría Integral y Análisis Estratégico — CUDII POS

**Fecha:** Agosto 2026  
**Versión analizada:** Post-Fase 3+ (commit `20b350b`) — actualizado a Fase 4 (commit `7870d88`): clientes/crédito, lealtad, dashboard personalizable, inventario/mermas/recepciones  
**Alcance:** Schema, Backend (NestJS), Frontend (React/Vite), Seguridad, Benchmark competitivo

> **Nota de actualización (Fase 4):** Las secciones §1.2/§1.3 se actualizaron para reflejar el estado actual. Se añadió la migración `20260820000005_add_timestamps_audit` (14 tablas con timestamps de auditoría). El dashboard pasó de "placeholder" a rejilla personalizable con react-grid-layout. Los hallazgos de performance/paginación (§2.5, §2.6) y campos muertos (§2.2) siguen siendo válidos como backlog.

> **Nota de actualización (revisión Fase 4 - post-revisión):** Aplicadas las correcciones de la sesión: (1) **sidebar por rol** — la fila **A10** de §4.2 ahora está **resuelta** (`permisos.ts` + `MainLayout.tsx` + `RequireRol` en `App.tsx`); (2) **Reportes** — `top-products`/`margin` ya no arrojan Error 500 al filtrar por fecha (fix de `Prisma.join(condiciones, ' ')` en `reports.service.ts`); (3) **Auditoría** — el módulo ahora registra eventos sensibles `VENTA_COMPLETADA` y `DEVOLUCION_REGISTRADA` además de los de caja, reflejado en `AuditoriaView.tsx`.

---

## 1. Resumen Ejecutivo y Alcance

### 1.1 Propuesta de Valor

CUDII es un **POS SaaS multitenant** diseñado para tiendas de conveniencia y comercios del mercado mexicano/latinoamericano. Su propuesta de valor diferenciadora es:

- **Multi-tenant nativo**: Una instancia sirve múltiples empresas con aislamiento por `empresaId`/`sucursalId`
- **Trazabilidad FEFO**: Asignación automática de lotes por caducidad más próxima (diferenciador vs. soluciones genéricas)
- **RBAC granular**: 6 roles con permisos `MODULO:ACCION` desde Fase 1
- **Stack moderno**: NestJS + Prisma + React + Tailwind + PostgreSQL + Redis

### 1.2 Alcance Cubierto (Funcional)

| Módulo | Funcionalidad | Estado |
|--------|--------------|--------|
| **Auth** | Login JWT, refresh tokens, RBAC guards, onboarding | ✅ Completo |
| **Catálogo** | CRUD productos, categorías, precios por unidad, unidades de medida | ✅ Completo |
| **Inventario** | Stock por sucursal, lotes FEFO, caducidades, historial de movimientos | ✅ Completo |
| **Mermas** | Registro de mermas/shrinkage con motivo y costo | ✅ Completo |
| **Recepciones** | Ingreso de mercancía con asignación de lotes y costo | ✅ Completo |
| **Ventas** | POS completo: carrito, pago mixto, folios, trazabilidad venta↔lote | ✅ Completo |
| **Devoluciones** | Notas de crédito con motivo, destino (stock/merma), trazabilidad | ✅ Completo |
| **Caja** | Apertura, cierre, retiros parciales, cortes X/Z | ✅ Completo |
| **Proveedores** | CRUD completo con soft delete | ✅ Completo |
| **Usuarios** | CRUD con roles, protegido contra escalada de privilegios | ✅ Completo |
| **Configuración** | Tema visual, modo corte Z, umbrales | ✅ Completo |
| **Clientes / Crédito (Fase 4)** | CRUD clientes, cuentas de crédito/fiado, abonos, saldo pendiente | ✅ Completo |
| **Lealtad (Fase 4)** | Programa de puntos, niveles, canje FIFO, configuración | ✅ Completo |
| **Venta al crédito (Fase 4)** | Cobro de deuda, referencias, indicador cliente/público | ✅ Completo |
| **Notificaciones** | Backend CRUD + campana en frontend (polling 60s, filtros) | ✅ Completo |
| **Reportes** | Resumen de ventas, reportes ejecutivos, exportación | ✅ Implementado |
| **Auditoría** | Logs de actividad con filtros y paginación; registra eventos de caja + `VENTA_COMPLETADA`/`DEVOLUCION_REGISTRADA` | ✅ Completo |
| **Dashboard (Fase 4)** | KPIs, tendencia, métodos de pago, TOP, mini-TODO — rejilla react-grid-layout personalizable por rol | ✅ Implementado |

### 1.3 Fuera de Alcance Actual

| Funcionalidad | Estado | Impacto |
|--------------|--------|---------|
| CRM avanzado (segmentación, campañas) | ✅ Base hecha (CRUD+crédito+lealtad); ❌ segmentación avanzada | Medio |
| Reportes avanzados | ✅ Resumen/ejecutivos; ❌ analítica profunda | Medio — el gerente no puede tomar decisiones |
| Dashboard con KPIs | ✅ Rejilla personalizable por rol | Resuelto |
| Códigos de barras | ❌ Sin escaneo ni generación | Medio — Velocidad de checkout |
| Modo offline | ❌ Sin soporte | Medio — Resiliencia |
| Facturación CFDI 4.0 | ❌ Fuera de alcance (Fase 6) | Bajo a corto plazo |
| Órdenes de compra | ❌ Solo GRN sin PO previo | Medio — Flujo de compras incompleto |
| Descuentos programables | ❌ Solo descuento manual en venta | Medio — Marketing |
| Exportación a PDF/CSV | ❌ Solo en ProveedoresView | Bajo |

---

## 2. Auditoría de Arquitectura de Datos y Consistencia Full-Stack

### 2.1 Modelo de Datos — Inventario Completo

**26 modelos, 12 enums, ~140 campos, ~50 relaciones**

| Modelo | Campos | Relaciones | Índices | Salud |
|--------|--------|-----------|---------|-------|
| Empresa | 12 | 10 | PK only | ⚠️ 2 campos muertos |
| Sucursal | 6 | 6 | PK only | ⚠️ 1 campo muerto |
| Caja | 6 | 2 | PK only | ✅ |
| Usuario | 9 | 13 | email @unique | ✅ |
| Producto | 14 | 9 | PK only | ⚠️ 2 campos muertos, FK sin índice |
| PrecioPorUnidad | 8 | 1 | PK only | ⚠️ FK sin índice |
| InventarioSucursal | 6 | 2 | @@unique(sucursalId, productoId) | ✅ |
| MovimientoInventario | 9 | 3 | PK only | ⚠️ FKs sin índice |
| Categoria | 8 | 1 | PK only | ⚠️ 2 campos muertos read-side |
| Lote | 15 | 5 | 2 composites | ✅ |
| RecepcionMercancia | 7 | 1 | 2 indexes | ✅ |
| RecepcionDetalle | 6 | 2 | PK only | ⚠️ FKs sin índice |
| DetalleVentaLote | 4 | 2 | @@index(loteId) | ✅ |
| Merma | 10 | 4 | 2 indexes | ✅ |
| SesionCaja | 14 | 4 | PK only | ⚠️ FKs sin índice |
| RetiroParcial | 5 | 2 | PK only | ⚠️ FKs sin índice |
| CorteX | 8 | 2 | PK only | ⚠️ FKs sin índice |
| CorteZ | 13 | 2 | PK + sesionCajaId @unique | ✅ |
| Venta | 14 | 5 | **PK only** | 🔴 5 FKs sin índice |
| DetalleVenta | 10 | 2 | PK only | 🔴 ventaId sin índice |
| PagoVenta | 6 | 1 | PK only | 🔴 ventaId sin índice |
| Devolucion | 8 | 2 | PK only | 🔴 ventaId sin índice |
| DevolucionProducto | 7 | 3 | PK only | ⚠️ FKs sin índice |
| LogActividad | 10 | 2 | 4 indexes | ✅ |
| Proveedor | 9 | 1 | 2 indexes | ✅ |
| Notificacion | 9 | 2 | 3 indexes | ✅ |

### 2.2 Campos Muertos (Escritos pero Nunca Leídos en Negocio)

| Modelo | Campo | Evidencia | Recomendación |
|--------|-------|-----------|---------------|
| Empresa | `bloquearVentaVencidos` | 0 reads en `lotes.helper.ts` — se consumen lotes vencidos ignorando este flag | **Implementar lógica** o eliminar |
| Empresa | `rfc` | Escrito en onboarding, nunca consultado | Mantener para Fase 4 (CFDI) |
| Empresa | `creadoEn` | Nunca seleccionado en queries | Mantener (estándar de auditoría) |
| Sucursal | `direccion` | Nunca leído en queries | Mantener para futuro |
| Producto | `tieneCaducidad` | Nunca validado en GRN — `fechaCaducidad` del lote determina comportamiento | **Implementar validación** o eliminar |
| Producto | `descripcion` | Escrito, nunca en respuesta de API | Agregar a `include` en findOne |
| Categoria | `colorHex` | Escrito, nunca en respuesta de catálogo | Agregar a `include` en queries de categorías |
| Categoria | `icono` | Escrito, nunca en respuesta | Igual que colorHex |
| Lote | `proveedor` (String) | Escrito, nunca leído — reemplazado por `proveedorRef` FK | **Eliminar campo legacy** |
| Lote | `proveedorId` / `proveedorRef` | FK existe pero **nunca se populiza** al crear lote | Conectar a `CrearRecepcionDto` |
| LogActividad | `direccionIP` | Persistido, nunca en respuestas | Implementar en vista de auditoría o eliminar |
| LogActividad | `agenteUsuario` | Persistido, nunca en respuestas | Igual |
| Devolucion | `sesionCajaId` | Escrito, nunca filtrado ni indexado | Agregar índice o eliminar |
| Venta | `secuenciaFolio` | Redundante con `folio` string | Eliminar |

### 2.3 Mapeo Frontend → Backend (Coherencia)

| Backend Endpoint | Frontend Lo Consume | Estado |
|-----------------|--------------------:|--------|
| `POST /auth/login` | ✅ LoginView | OK |
| `GET /auth/profile` | ✅ MainLayout | OK |
| `GET /company-settings/theming` | ✅ useThemeStore | OK |
| `POST /onboarding/setup` | ✅ OnboardingView | OK |
| `GET/POST/PUT/DELETE /products` | ✅ ProductosView | OK |
| `GET/POST/PUT/DELETE /categories` | ✅ CategoriasView | OK |
| `GET /inventory/stock/:id` | ✅ InventarioView | ⚠️ Parcial |
| `GET /inventory/lotes` | ✅ LotesView | OK |
| `POST /inventory/recepciones` | ✅ RecepcionMercanciaModal | OK |
| `GET /inventory/recepciones` | ❌ Nunca consumido | Sin vista de historial |
| `GET /inventory/vencimientos` | ❌ Nunca consumido | Sin alerta dedicada |
| `POST /inventory/adjust` | ✅ InventarioView | OK |
| `POST /merma` | ❌ Nunca consumido | Sin vista de registro |
| `GET /merma` | ⚠️ InventarioView (parcial) | Sin vista dedicada |
| `POST /sales` | ✅ PosView | OK |
| `GET /sales` | ❌ Nunca consumido | Sin historial de ventas |
| `POST /returns` | ✅ PosView (modal) | OK |
| `GET /returns` | ❌ Nunca consumido | Sin historial de devoluciones |
| `GET/POST /cash-register/*` | ✅ CajasView + PosView | OK |
| `GET/POST /suppliers` | ✅ ProveedoresView | OK |
| `GET/POST/PUT/DELETE /users` | ✅ UsuariosView | OK |
| `GET /notifications` | ✅ NotificationBell | OK |
| `GET /audit` | ✅ AuditoriaView | OK |
| `GET /reports/daily-sales` | ❌ Nunca consumido | Sin vista de reportes |
| `GET /reports/products` | ❌ Nunca consumido | Sin vista de reportes |
| `GET /reports/inventory` | ❌ Nunca consumido | Sin vista de reportes |

**6 endpoints de reportes, 3 de historial, 2 de mermas, 1 de vencimientos = 12 endpoints sin consumo frontend.**

### 2.4 Formato de Paginación Inconsistente

| Módulo | Key datos | Key meta | Problema |
|--------|-----------|----------|----------|
| Sales | `datos` | `pagina`, `limite`, `totalPaginas` | Inglés vs español |
| Inventory | `data` | `page`, `limit`, `totalPages`, `hasNextPage` | Inglés, distinto formato |
| Products | `data` | `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage` | Más campos |
| Categories | `data` | `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage` | OK |
| Users | `data` | `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage` | OK |
| Suppliers | `data` | `page`, `limit`, `totalPages`, `hasNextPage` | Sin `hasPrevPage` |
| Notifications | `datos` | `pagina`, `limite`, `totalPaginas` | Español |
| Audit | `datos` | `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage` | Mixto |

**3 convenciones distintas.** El frontend debe manejar ambas (`datos`/`data`, `pagina`/`page`).

### 2.5 Endpoints sin Paginación (Riesgo de Performance)

| Endpoint | Línea | Impacto |
|----------|-------|---------|
| `GET /returns` | `returns.service.ts:337` | Devuelve TODAS las devoluciones de la empresa |
| `GET /inventory/recepciones` | `inventory.service.ts:283` | Devuelve TODAS las recepciones |
| `GET /merma` | `merma.service.ts:182` | Devuelve TODAS las mermas |
| `GET /inventory/vencimientos` | `inventory.service.ts:414` | Devuelve arrays sin límite |

### 2.6 Problemas N+1 (Performance en Transacciones)

| Ubicación | Problema | Impacto |
|-----------|----------|---------|
| `sales.service.ts:76` | `tx.producto.findFirst()` en loop por cada ítem de venta | Venta de 10 items = 10 queries |
| `inventory.service.ts:146` | `tx.producto.findFirst()` en loop por cada ítem de GRN | Recepción de 20 items = 20 queries |
| `returns.service.ts:158,229` | `tx.lote.findUnique()` + `tx.lote.update()` por cada lote por cada ítem | Devolución de 5 items × 3 lotes = 15 queries |
| `inventory.service.ts:472` | `notificacion.findFirst()` por cada lote por vencer para deduplicar | O(n) queries |

### 2.7 Índices Faltantes en FKs Críticas

| Tabla | FK sin Índice | Consultas Afectadas |
|-------|--------------|---------------------|
| **Venta** | `empresaId`, `sucursalId`, `sesionCajaId`, `cajeroId`, `cajaId` | `findAllSales` filtra por todos estos |
| **DetalleVenta** | `ventaId` | Toda venta incluye detalles |
| **PagoVenta** | `ventaId` | Toda venta incluye pagos |
| **Devolucion** | `ventaId` | `findAllReturns` une por venta |
| **MovimientoInventario** | `sucursalId`, `loteId` | Historial de stock |
| **SesionCaja** | `cajaId`, `cajeroId` | Sesión actual |
| **Producto** | `empresaId` | Listado de productos |
| **Sucursal** | `empresaId` | Multi-tenant base |
| **Caja** | `sucursalId` | Cajas por sucursal |
| **Categoria** | `empresaId` | Categorías por empresa |

**`Venta` es la tabla más caliente del POS y tiene 5 FKs sin índice.** Esto es crítico.

### 2.8 Enums con Valores No Utilizados

| Enum | Valor No Usado | Evidencia |
|------|---------------|-----------|
| EstadoVenta | `reembolsada` | Solo se usa `completada` y `cancelada` |
| MetodoPago | `voucher`, `credito` | Solo se usa `efectivo`, `tarjeta`, `transferencia` |
| MotivoMerma | `robo`, `perdida` | Solo se usa `caducado`, `danado`, `error`, `otro` |
| TipoMovimientoInventario | `traspaso_salida`, `traspaso_entrada` | No existe feature de traslados |

### 2.9 Tipos String Donde Debería Ser Enum

| Modelo | Campo | Valores Hardcoded | Recomendación |
|--------|-------|-------------------|---------------|
| LogActividad | `severidad` | `'info'`, `'warning'`, `'critical'` | `enum Severidad` |
| LogActividad | `accion` | `'APERTURA_CAJA'`, `'CORTE_X'`, etc. | `enum TipoAccionLog` |
| LogActividad | `entidadTipo` | `'sesion_caja'`, `'venta'`, etc. | `enum EntidadTipo` |
| Notificacion | `tipo` | `'info'`, `'warning'`, `'critical'` | Reusar `enum Severidad` |
| Notificacion | `evento` | `'corte_z_realizado'`, `'lote_por_vencer'`, etc. | `enum TipoEvento` |
| CorteZ | `tipoDiscrepancia` | `'cuadre'`, `'sobrante'`, `'faltante'` | `enum TipoDiscrepancia` |

---

## 3. Benchmark Competitivo

### 3.1 Matriz de Funcionalidades vs. POS Globales

| Funcionalidad | CUDII POS | Toast POS | Square POS | Shopify POS | Cobertura CUDII |
|--------------|-----------|-----------|------------|-------------|-----------------|
| **Ventas (checkout)** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Pago mixto** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Multi-sucursal** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Multi-tenant** | ✅ | ❌ | ❌ | ❌ | **Diferenciador** |
| **RBAC granular** | ✅ | ⚠️ Básico | ⚠️ Básico | ⚠️ Básico | **Superior** |
| **Inventario con lotes** | ✅ | ✅ (xtraCHEF) | ✅ (Plus) | ✅ | 100% |
| **FEFO automático** | ✅ | ⚠️ Manual | ❌ | ❌ | **Diferenciador** |
| **Mermas/shrinkage** | ✅ | ✅ | ✅ | ⚠️ | 100% |
| **Devoluciones** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Caja (sesiones, cortes)** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Proveedores** | ✅ | ✅ | ✅ (PO) | ✅ | 80% (sin PO) |
| --- | --- | --- | --- | --- | --- |
| **Clientes/CRM** | ❌ | ✅ | ✅ | ✅ | **0%** |
| **Dashboard con KPIs** | ❌ | ✅ (Toast IQ) | ✅ | ✅ | **0%** |
| **Reportes avanzados** | ⚠️ 3 básicos | ✅ Decenas | ✅ COGS, sell-through | ✅ | **15%** |
| **Códigos de barras** | ❌ | ✅ | ✅ | ✅ | **0%** |
| **Órdenes de compra** | ⚠️ GRN sin PO | ✅ | ✅ (PO) | ✅ | **30%** |
| **Descuentos programables** | ❌ | ✅ (happy hour) | ✅ | ✅ | **0%** |
| **Modo offline** | ❌ | ✅ (best-in-class) | ⚠️ | ⚠️ | **0%** |
| **Exportación PDF/CSV** | ⚠️ Parcial | ✅ | ✅ | ✅ | **20%** |
| **Notificaciones push** | ⚠️ Backend only | ✅ | ✅ | ✅ | **40%** |
| **Programa de lealtad** | ❌ | ✅ | ✅ | ✅ | **0%** |
| **Gift cards** | ❌ | ✅ | ✅ | ✅ | **0%** |
| **Marketing (email/SMS)** | ❌ | ✅ (Toast IQ Grow) | ✅ | ✅ | **0%** |
| **Nómina** | ❌ | ✅ | ✅ (Square Payroll) | ❌ | **0%** |
| **Facturación fiscal** | ❌ (Fase 6) | ❌ | ❌ | ❌ (MX only) | Roadmap |
| **API abierta** | ✅ REST | ⚠️ 200 integraciones | ✅ API completa | ✅ | 100% |
| **KDS (kitchen display)** | ❌ | ✅ | ⚠️ 3rd party | ❌ | N/A (tienda) |

### 3.2 Cobertura Funcional vs. Mercado

```
CUDII POS:  ████████████░░░░░░░░░░░░░░░░░░  ~42%
Toast POS:  ████████████████████████████████  ~95% (restaurante)
Square POS: ██████████████████████████░░░░░░  ~82% (retail)
Shopify POS: ████████████████████████████░░░  ~85% (retail + ecomm)
```

### 3.3 Fortalezas Competitivas de CUDII

| Fortaleza | Detalle | Relevancia |
|-----------|---------|------------|
| **Multi-tenant nativo** | Toast y Square son single-tenant; CUDII aísla datos por empresa | Alto para SaaS |
| **FEFO automático** | Asignación inteligente de lotes; Toast es manual | Diferenciador en alimentos |
| **RBAC granular** | 6 roles con permisos MODULO:ACCION; otros POS solo 3-4 roles | Seguridad empresarial |
| **Stack moderno** | NestJS + Prisma + React; la mayoría de POS usa PHP/Laravel o stacks legacy | Mantenibilidad |
| **Costo cero de licencia** | Open source vs. $69-$149/mes de Toast/Square | Atractivo para microempresas |

### 3.4 Gaps Críticos vs. Estándar de Industria

| Gap | Impacto en Decisión de Compra | Esfuerzo |
|-----|-------------------------------|----------|
| **Sin Dashboard** | Gerente no puede ver KPIs → no adopta el sistema | Medio |
| **Sin CRM/Clientes** | No hay fidelización → no hay retención | Alto |
| **Sin reportes** | No hay visibilidad → no hay decisiones | Medio |
| **Sin códigos de barras** | Checkout lento → loss de productividad | Medio |
| **Sin modo offline** | Si se corta internet, la tienda para | Alto |
| **Sin exportación** | No puede integrar con contador | Bajo |

---

## 4. Plan de Optimización Estratégica (Matriz de Acción)

### 4.1 🔴 POR MEJORAR (Refactorizaciones Técnicas)

| # | Área | Problema | Solución | Esfuerzo | Impacto |
|---|------|----------|----------|----------|---------|
| M1 | **Seguridad** | `.env` con credenciales hardcodeadas y sin `.gitignore` | Rotar secrets, agregar `.env` a `.gitignore`, usar variables de entorno seguras | Bajo | Crítico |
| M2 | **Seguridad** | CORS abierto a todos los orígenes (`main.ts:8`) | Configurar `enableCors({ origin: ['http://localhost:5173'] })` | Bajo | Alto |
| M3 | **Route collision** | `notifications/read-all` y `suppliers/reactivate` inalcanzables por orden de rutas NestJS | Reordenar rutas: estáticas antes de paramétricas | Bajo | Alto |
| M4 | **Performance** | 5 FKs en `Venta` sin índice — tabla más caliente del POS | `@@index([empresaId])`, `@@index([sucursalId])`, `@@index([sesionCajaId])`, `@@index([cajeroId])` | Bajo | Crítico |
| M5 | **Performance** | FKs sin índice en `DetalleVenta`, `PagoVenta`, `Devolucion` | Agregar `@@index([ventaId])` en cada una | Bajo | Alto |
| M6 | **Performance** | N+1 en `createSale` — `findFirst` por cada ítem | Batch-load: `findMany({ where: { id: { in: ids } } })` antes del loop | Bajo | Alto |
| M7 | **Performance** | N+1 en `createRecepcion` — mismo patrón | Batch-load de productos antes del loop | Bajo | Alto |
| M8 | **Performance** | 4 endpoints sin paginación (`returns`, `recepciones`, `merma`, `vencimientos`) | Agregar `skip`/`take` con cursor | Medio | Alto |
| M9 | **Consistencia** | 3 formatos de paginación distintos (`datos`/`data`, `pagina`/`page`) | Estandarizar a un formato único: `{ data, meta: { page, limit, total, totalPages, hasNextPage } }` | Medio | Medio |
| M10 | **Schema** | 14 campos muertos (ver §2.2) | Implementar reads o eliminar cada uno | Medio | Medio |
| M11 | **Schema** | 6 campos como `String` donde debería ser `enum` (ver §2.7) | Crear enums y migrar | Medio | Medio |
| M12 | **Schema** | `Lote.proveedor` (String legacy) + `proveedorId` nunca populizado | Eliminar campo legacy, conectar `proveedorId` en GRN | Bajo | Medio |
| M13 | **Código** | `any` en `suppliers.service.ts:43` | Cambiar a `Prisma.ProveedorWhereInput` | Bajo | Bajo |
| M14 | **Código** | `require()` en `unidad.util.ts:67,73` | Mover a importaciones top-level | Bajo | Bajo |
| M15 | **Código** | DTO sin validar en `inventory/adjust` (body raw) | Crear `AdjustStockDto` con `class-validator` | Bajo | Medio |
| M16 | **Frontend** | `fetch()` raw en `InventarioView` en vez de `api` instance | Reemplazar por `api.get()` para interceptores de auth | Bajo | Alto |
| M17 | **Frontend** | Sin `ErrorBoundary` en rutas | Agregar `ErrorBoundary` wrapper en App.tsx | Bajo | Medio |
| M18 | **Backend** | Sin `try/catch` en services — errores Prisma como 500 | Agregar manejo de `PrismaClientKnownRequestError` | Medio | Medio |

### 4.2 🟡 POR AÑADIR (Gaps Críticos de Industria)

| # | Funcionalidad | Descripción | Prioridad | Esfuerzo | Fase Sugerida |
|---|--------------|-------------|-----------|----------|---------------|
| A1 | **Dashboard con KPIs** | Ventas del día, ticket promedio, productos top, alertas de stock, gráfico de tendencias | 🔴 Alta | Medio | Fase 4 |
| A2 | **Módulo de Clientes** | Schema `Cliente`, CRUD, historial de compras, notas | 🔴 Alta | Alto | Fase 4 |
| A3 | **Reportes avanzados** | Ventas por cliente, ventas por categoría, tendencias, COGS, rotación de inventario | 🔴 Alta | Medio | Fase 4 |
| A4 | **Historial de ventas** | Vista `GET /consumed` con filtros, paginación, exportación | 🔴 Alta | Medio | Fase 4 |
| A5 | **Historial de devoluciones** | Vista `GET /returns` con filtros y paginación | 🟠 Media | Bajo | Fase 4 |
| A6 | **Gestión de mermas** | Vista dedicada para registrar y consultar mermas | 🟠 Media | Bajo | Fase 4 |
| A7 | **Códigos de barras** | Generación de etiquetas + escaneo en POS | 🟠 Media | Medio | Fase 5 |
| A8 | **Órdenes de compra** | PO → GRN (no solo GRN directo) | 🟠 Media | Alto | Fase 5 |
| A9 | **Reportes exportables** | PDF/CSV en todos los reportes | 🟠 Media | Medio | Fase 4 |
| A10 | ~~**Filtrado por roles en sidebar**~~ | ~~Ocultar links admin a CAJERO~~ → **Resuelto:** `frontend/src/lib/permisos.ts` + `MainLayout.tsx` filtran por `user.rol` (SUPER_ADMIN ve todo) | ✅ Hecho | Bajo | Tan pronto |
| A11 | **Modo offline** | IndexedDB + sync para ventas básicas | 🟡 Baja | Muy alto | Fase 6 |
| A12 | **Descuentos programables** | Promociones con reglas (2x1, happy hour, por categoría) | 🟡 Baja | Alto | Fase 5 |
| A13 | **Notificaciones push** | Email/SMS para alertas de stock, lotes por vencer | 🟡 Baja | Medio | Fase 5 |
| A14 | **Programa de lealtad** | Puntos por compra, canjeo | 🟡 Baja | Alto | Fase 5 |
| A15 | **Batch import** | CSV/Excel para productos y clientes | 🟡 Baja | Medio | Fase 5 |

### 4.3 🟢 POR ELIMINAR / SIMPLIFICAR

| # | Elemento | Problema | Acción |
|---|----------|----------|--------|
| E1 | `Empresa.bloquearVentaVencidos` | Campo muerto — nunca leído en lógica de negocio | Eliminar o implementar en `lotes.helper.ts` |
| E2 | `Producto.tieneCaducidad` | Nunca validado — `fechaCaducidad` del lote determina comportamiento | Eliminar o agregar validación en GRN |
| E3 | `Venta.secuenciaFolio` | Redundante con `folio` string | Eliminar |
| E4 | `Devolucion.sesionCajaId` | Escrito, nunca query ni indexado | Eliminar o agregar FK index |
| E5 | `Lote.proveedor` (String) | Legacy, reemplazado por `proveedorId` FK | Eliminar |
| E6 | `LogActividad.direccionIP` | Persistido, nunca leído | Implementar en auditoría o eliminar |
| E7 | `LogActividad.agenteUsuario` | Persistido, nunca leído | Implementar en auditoría o eliminar |
| E8 | `inventory/dto/create-product.dto.ts` | DTO huérfano — nunca importado | Eliminar |
| E9 | `inventory/dto/update-product.dto.ts` | DTO huérfano — nunca importado | Eliminar |
| E10 | `AuditService.buscarPorUsuario` | Método definido, nunca llamado por controller | Implementar endpoint o eliminar |
| E11 | `EstadoVenta.reembolsada` | Valor enum sin uso | Reservar para futuro o eliminar |
| E12 | `MetodoPago.voucher`, `credito` | Valores sin uso | Reservar para futuro o eliminar |
| E13 | `MotivoMerma.robo`, `perdida` | Valores sin uso | Reservar para futuro o eliminar |
| E14 | `TipoMovimientoInventario.traspaso_*` | Valores sin uso — feature de traslados no existe | Reservar para futuro o eliminar |
| E15 | `NotificationsService` inyectado en Onboarding | Solo se usa en seed, no en flujo real | Remover inyección si no se usará |
| E16 | `LogsService` inyectado en Users/Onboarding | Nunca llamado por controllers | Remover inyección |

### 4.4 Secuencia de Ejecución Recomendada

```
┌─────────────────────────────────────────────────────────────────────┐
│  SPRINT 0 (1-2 días) — DEUDA TÉCNICA CRÍTICA                      │
│  M1: Rotar secrets + .gitignore                                    │
│  M2: CORS restrictivo                                              │
│  M3: Fix route collisions (notifications + suppliers)              │
│  M4: Índices en Venta FKs                                          │
│  M5: Índices en DetalleVenta, PagoVenta, Devolucion FKs            │
│  E8-E9: Eliminar DTOs huérfanos                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  SPRINT 1 (1 semana) — FASE 4: CLIENTES + DASHBOARD               │
│  A2: Módulo de Clientes (schema + backend + frontend)              │
│  A1: Dashboard con KPIs (ventas del día, ticket promedio, alertas) │
│  A4: Historial de ventas con filtros                               │
│  A5: Historial de devoluciones                                     │
│  A10: Sidebar filtrado por roles                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  SPRINT 2 (1 semana) — FASE 4: REPORTES + MERMA                   │
│  A3: Reportes avanzados (ventas por cliente, categoría, tendencia) │
│  A9: Exportación PDF/CSV                                           │
│  A6: Gestión de mermas (vista dedicada)                            │
│  M6-M7: Fix N+1 queries (batch-load en ventas y recepciones)      │
│  M8: Paginación en endpoints sin límite                            │
│  M9: Estandarizar formato de paginación                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  SPRINT 3 (2 semanas) — FASE 5: CÓDIGOS DE BARRAS + COMPRAS      │
│  A7: Códigos de barras (generación + escaneo)                      │
│  A8: Órdenes de compra (PO → GRN)                                  │
│  A12: Descuentos programables                                      │
│  M10-M12: Limpieza de schema (campos muertos, enums, legacy)       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FUTURO (Fase 5-6) — DIFERENCIACIÓN                               │
│  A11: Modo offline (IndexedDB + sync)                              │
│  A13: Notificaciones push (email/SMS)                              │
│  A14: Programa de lealtad                                          │
│  A15: Batch import                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Hallazgos Clave

1. **CUDII tiene 42% de cobertura funcional** vs. un POS global. Las fortalezas (multi-tenant, FEFO, RBAC) lo posicionan bien para el mercado的目标, pero los gaps en CRM, dashboard y reportes impiden adopción.

2. **La tabla `Venta` tiene 5 FKs sin índice** — esto es un riesgo de performance crítico en producción. Es la corrección más urgente del proyecto.

3. **Hay 12 endpoints backend sin consumo frontend** — funcionalidad construida pero invisible para el usuario.

4. **3 formatos de paginación distintos** crean complejidad innecesaria en el frontend.

5. **14 campos muertos en el schema** — datos que se escriben pero nunca se leen, occupando espacio y creando confusión.

6. **2 bugs de route collision** en NestJS (`notifications/read-all`, `suppliers/reactivate`) — estos endpoints son inalcanzables actualmente.

7. **El `.env` con credenciales hardcodeadas no está en `.gitignore`** — riesgo de seguridad inmediato.

8. **Sin Dashboard** — el gerente no tiene visibilidad operacional, lo cual es un deal-breaker para adopción empresarial.
