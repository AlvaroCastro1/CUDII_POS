# Análisis Completo del Sistema CUDII POS

**Fecha:** Agosto 2026
**Alcance:** Entidades de BD, uso Frontend/Backend, buenas prácticas, comparativa con POS globales

---

## 1. ABSTRACCIÓN DE ENTIDADES DE BASE DE DATOS

### 1.1 Modelos Activos (20 de 26 — en uso confirmado)

| # | Modelo | Tabla | Uso | Módulo Backend | Vistas Frontend |
|---|--------|-------|-----|----------------|-----------------|
| 1 | Empresa | `empresas` | Tenant raíz multi-sucursal | Onboarding, Auth, Reports | DashboardLayout |
| 2 | Sucursal | `sucursales` | Ubicación/tienda | Onboarding, Auth, Reports | DashboardLayout |
| 3 | Usuario | `usuarios` | Usuarios con roles/permisos | Auth, Users, Onboarding | LoginView, UsuariosView |
| 4 | RolPermiso | `rol_permisos` | Matriz RBAC role↔permiso | Auth (uards) | — |
| 5 | Categoria | `categorias` | Árbol de categorías | Categories | CategoriasView |
| 6 | Producto | `productos` | Catálogo de productos | Products | ProductosView |
| 7 | Proveedor | `proveedores` | Proveedores | Inventory | ProveedoresView |
| 8 | ProveedorCategoria | `proveedor_categorias` | Relación proveedor↔categoría | Inventory | ProveedoresView |
| 9 | InventarioSucursal | `inventario_sucursal` | Stock por sucursal | Inventory | InventarioView |
| 10 | Lote | `lotes` | Lotes con caducidad FEFO | Inventory (Lotes) | LotesView |
| 11 | HistorialStock | `historial_stock` | Movimientos de inventario | Inventory | InventarioView (historial) |
| 12 | Merma | `mermas` | Mermas/shrinkage | Inventory (Merma) | InventarioView |
| 13 | Venta | `ventas` | Transacciones de venta | Sales | PosView |
| 14 | DetalleVenta | `detalle_ventas` | Líneas de venta | Sales | PosView (carrito) |
| 15 | DetalleVentaLote | `detalle_venta_lotes` | Asignación venta↔lote (FEFO) | Sales | PosView (auto) |
| 16 | Devolucion | `devoluciones` | Notas de crédito | Returns | PosView (modal) |
| 17 | DetalleDevolucion | `detalle_devoluciones` | Líneas de devolución | Returns | PosView (modal) |
| 18 | Caja | `cajas` | Registro de cajas | CashRegister | CajasView |
| 19 | SesionCaja | `sesiones_caja` | Sesiones apertura/cierre | CashRegister | CajasView |
| 20 | MovimientoCaja | `movimientos_caja` | Entradas/salidas de efectivo | CashRegister | CajasView |

### 1.2 Modelos Parcialmente Activos (3)

| Modelo | Uso confirmado | Uso faltante |
|--------|---------------|--------------|
| ConfiguracionEmpresa | Seed carga datos, Auth lee theming | No hay vista de edición para admin (solo `company-settings` GET) |
| AuditLog | Logs de ventas y devoluciones se insertan | No hay endpoint dedicado de consulta; módulo `audit` existe sin controller real |
| RefreshToken | Login genera tokens, logout los invalida | — (completo para su uso) |

### 1.3 Modelos No Utilizados / Potencialmente Eliminables (3)

| Modelo | Por qué no se usa | Recomendación |
|--------|-------------------|---------------|
| **Notificacion** | Tabla existe pero ningún service inserta registros; frontend no las consume | **Eliminar** o implementar el módulo completo (frontend + backend) |
| **HistorialPrecioProducto** | Trigger/schema existe pero `products.update` sobrescribe precio sin registrar histórico | **Implementar** (fácil: insertar antes de UPDATE en products service) o eliminar si no es requerimiento |
| **CodigoQR Pedido** | Tabla schema pero 0 uso en任何 módulo | **Eliminar** — funcionalidad no requerida para POS de tienda física |

### 1.4 Enums (12)

| Enum | Valores | Uso |
|------|---------|-----|
| RolUsuario | SUPER_ADMIN, ADMIN, CAJERO, INVENTARIO | Auth guards + seed |
| MetodoPago | EFECTIVO, TARJETA_DEBITO, TARJETA_CREDITO, TRANSFERENCIA, QR | Venta |
| EstadoVenta | PENDIENTE, COMPLETADA, ANULADA | Venta |
| EstadoDevolucion | PENDIENTE, APROBADA, RECHAZADA | Devolucion |
| EstadoLote | DISPONIBLE, AGOTADO, VENCIDO | Lote |
| EstadoMerma | REGISTRADA, REVISADA | Merma |
| EstadoSesionCaja | ABIERTA, CERRADA | SesionCaja |
| TipoMovimientoCaja | VENTA, APERTURA, CIERRE, DEVOLUCION, AJUSTE, MERMA | MovimientoCaja |
| TipoDescuento | PORCENTAJE, MONTO_FIJO | Venta |
| UnidadProducto | UNIDAD, KG, LT, MT, M2, M3, PAR, DOCENA, CAJA | Producto |
| MetodoEntrada | COMPRA, DEVOLUCION_PROVEEDOR, AJUSTE, MERMA, TRASLADO | HistorialStock |
| TipoPermiso | MODULO, ACCION | RolPermiso |

---

## 2. MAPEO BACKEND → BASE DE DATOS (Uso por Módulo)

### 2.1 Módulos con Uso Completo

| Módulo | Endpoints | Modelos Usados | RBAC | Estado |
|--------|-----------|---------------|------|--------|
| **Auth** | login, logout, refresh, profile, onboarding-status | Usuario, RefreshToken, Empresa, Sucursal, RolPermiso, ConfiguracionEmpresa | Todos autenticados | ✅ |
| **Onboarding** | POST + GET setup | Empresa, Sucursal, Usuario | Público (primera vez) | ✅ |
| **Products** | CRUD completo | Producto, Categoria | inventory:read/write | ✅ |
| **Categories** | CRUD completo | Categoria | inventory:read/write | ✅ |
| **Inventory** | stock, lotes, merma, suppliers, GRN, historial, low-stock, stats | InventarioSucursal, Lote, Merma, HistorialStock, Proveedor, ProveedorCategoria | inventory:* | ✅ |
| **Sales** | POST crear venta | Venta, DetalleVenta, DetalleVentaLote, InventarioSucursal, Lote, HistorialStock, AuditLog | sales:create | ✅ |
| **Returns** | POST crear devolución | Devolucion, DetalleDevolucion, Venta, InventarioSucursal, Lote, AuditLog | sales:create | ✅ |
| **CashRegister** | open, close, movements, history, current | Caja, SesionCaja, MovimientoCaja | cash-register:* | ✅ |
| **Reports** | daily-sales, products, inventory | Venta, DetalleVenta, Producto, InventarioSucursal | reports:read | ✅ |
| **Users** | CRUD + roles | Usuario | users:read/write | ✅ |
| **CompanySettings** | GET config | ConfiguracionEmpresa | company-settings:read | ✅ |

### 2.2 Servicios sin Uso Real en Controladores

| Servicio | Inyectado en | Controlador lo usa | Acción |
|----------|-------------|-------------------|--------|
| `NotificationsService` | Onboarding | ❌ (solo inserta en seed) | Implementar o eliminar módulo |
| `LogsService` | Users, Onboarding | ❌ (0 llamadas) | Implementar o eliminar |
| `AuditService` | — | ❌ (módulo existe sin controller) | Implementar vista de logs o eliminar |

### 2.3 Endpoints sin RBAC (seguridad)

| Endpoint | Método | Problema | Fix |
|----------|--------|----------|-----|
| `/auth/login` | POST | Público (correcto) | — |
| `/onboarding/setup` | POST | Público (correcto, solo primera vez) | Agregar rate limit |
| `/company-settings/theming` | GET | Sin auth guard | Agregar `@UseGuards(JwtAuthGuard)` |
| `/reports/daily-sales` | GET | Sin RBAC explícito | Agregar `@Roles('ADMIN', 'SUPER_ADMIN')` |
| `/reports/products` | GET | Sin RBAC explícito | Agregar `@Roles('ADMIN', 'SUPER_ADMIN')` |

---

## 3. MAPEO FRONTEND → API

### 3.1 Rutas y Vistas

| Ruta | Vista | Componentes | API Consumption |
|------|-------|-------------|-----------------|
| `/login` | LoginView | LoginForm | `POST /auth/login` ✅ |
| `/` | DashboardLayout | — | `GET /auth/profile`, `GET /company-settings/theming` ✅ |
| `/productos` | ProductosView | ProductoModalForm, ModalConfirm | `GET/POST/PUT/DELETE /products`, `GET /categories` ✅ |
| `/categorias` | CategoriasView | — | `GET/POST/PUT/DELETE /categories` ✅ |
| `/inventario` | InventarioView | RecepcionMercanciaModal, MovimientosInventarioModal, HistorialStockModal, ModalConfirm | `GET/POST /inventory/*`, `GET /suppliers` ✅ |
| `/lotes` | LotesView | — | `GET /inventory/lotes` ✅ |
| `/cajas` | CajasView | MovimientosCajaModal | `GET/POST /cash-register/*` ✅ |
| `/pos` | PosView | PosSidebar, SearchBar, CartItem, ProductGrid, VoucherModal, CantidadProductoModal, DevolucionModal | `POST /sales`, `POST /returns`, `GET /cash-register/current` ✅ |
| `/usuarios` | UsuariosView | UsuarioModalForm | `GET/POST/PUT/DELETE /users` ✅ |
| `/proveedores` | — | **FALTA Vista** | API existe (`GET/POST/PUT/DELETE /suppliers`) pero sin vista dedicada |
| `/clientes` | — | **FALTA Vista** | Módulo backend no existe; solo layout/rutas preparadas |

### 3.2 Stores (Estado Global)

| Store | Uso | API |
|-------|-----|-----|
| `useAuthStore` | Login/logout, tokens, roles | Auth endpoints ✅ |
| `useThemeStore` | Tema claro/oscuro | `GET /company-settings/theming` ✅ |
| `useCajaStore` | Sesión de caja abierta | `GET /cash-register/current` ✅ |

### 3.3 Gaps Frontend

| Gap | Prioridad | Esfuerzo |
|-----|-----------|----------|
| **Vista Proveedores** no existe | Alta | Bajo (CRUD estándar, API lista) |
| **Vista Clientes** no existe | Media | Medio (requiere schema + backend + frontend) |
| **Reportes** sin vista dedicada | Media | Medio |
| **AuditLog** sin vista | Baja | Bajo |
| **Notificaciones** sin UI | Baja | Medio |

---

## 4. ANÁLISIS DE BUENAS PRÁCTICAS

### 4.1 Lo que CUDII hace BIEN ✅

| Práctica | Implementación |
|----------|---------------|
| **Multi-tenancy por defecto** | Cada query filtra por `empresaId` y `sucursalId` |
| **RBAC completo** | Roles + permisos granulares (`MODULO:ACCION`), guards en cada controller |
| **Audit trail** | `AuditLog` registra ventas y devoluciones con metadatos |
| **FEFO (First Expiry First Out)** | Asignación automática de lotes por caducidad más próxima |
| **Validación de unidades** | `unidad.util.ts` con-valida unidades del catálogo en CrearProductoDTO |
| **Contraseñas hasheadas** | bcrypt con 12 rounds |
| **JWT con refresh tokens** | Access + refresh tokens, invalidación en logout |
| **Soft delete** | `deletedAt` en Producto, Categoria, Proveedor, Venta, Devolucion |
| **Historial de stock** | Cada movimiento registra ` MetodoEntrada` y metadatos |
| **Merma sin decrementar lote** | Corregido: merma solo decrementa `InventarioSucursal` |
| **Docker compose completo** | Backend, frontend, postgres, adminer |

### 4.2 Lo que CUDII podría MEJORAR ⚠️

| Área | Problema | Impacto | Recomendación |
|------|----------|---------|---------------|
| **Sin transacciones DB** | Ventas crean 5+ registros sin `prisma.$transaction()` | Alto — datos inconsistentes si falla a mitad | Envolver ventas en `prisma.$transaction()` |
| **Sin rate limiting** | Ningún endpoint tiene rate limit | Medio — vulnerable a abuso | Agregar `@Throttle()` de `@nestjs/throttler` |
| **Sin helmet** | Headers de seguridad HTTP ausentes | Medio | Agregar `app.use(helmet())` |
| **Sin validación de archivo .env** | No hay schema de validación para variables de entorno | Medio | Usar `@nestjs/config` con `Joi` o `zod` |
| **Sin logging estructurado** | `console.log` en producción | Bajo | Usar `PinoLogger` o `@nestjs/common Logger` |
| **Sin health check** | No hay endpoint `/health` | Bajo | Agregar para monitoring |
| **Sin paginación** | Listados devuelven todos los registros | Medio (escala) | Agregar `skip/take` con cursor |
| **Sin rate en login** | Login sin throttling | Alto — brute force | Rate limit 5/min en `/auth/login` |
| **Tests solo Postman** | Sin tests unitarios ni de integración | Alto — regresiones | Migrar a Jest (ya instalado) |
| **Frontend sin protección de rutas** | Rutas `/pos`, `/productos` accesibles sin auth | Alto | ProtectedRoute ya existe pero no se usa en todas las rutas |

### 4.3 Bugs Conocidos Corregidos

| Bug | Fix aplicado |
|-----|-------------|
| Merma decrementaba lote incorrectamente | Solo decrementa `InventarioSucursal`, no `Lote.cantidad` |
| Auto-lote `cantidadInicial` incorrecta | Usa stock pre-decremento |
| Pan Bimbo lotes desincronizados | Seed actualizado A=2, B=13 |
| `requiereLote` confuso | Renombrado a `tieneCaducidad` en todo el stack |

---

## 5. COMPARATIVA CON POS GLOBALES (Toast POS, Square)

### 5.1 Matriz de Funcionalidades

| Funcionalidad | CUDII POS | Toast POS | Square POS | Gap |
|--------------|-----------|-----------|------------|-----|
| **Ventas (checkout)** | ✅ | ✅ | ✅ | — |
| **Multi-producto por venta** | ✅ | ✅ | ✅ | — |
| **Múltiples métodos de pago** | ✅ | ✅ | ✅ | — |
| **Devoluciones** | ✅ | ✅ | ✅ | — |
| **Control de caja (sesiones)** | ✅ | ✅ | ✅ | — |
| **RBAC por roles** | ✅ | ✅ | ✅ | — |
| **Multi-sucursal** | ✅ | ✅ | ✅ | — |
| **Multi-tenant** | ✅ | ❌ (1 empresa) | ❌ (1 empresa) | CUDII SUPERIOR |
| **Inventario con lotes** | ✅ | ✅ (xtraCHEF) | ✅ (plus) | — |
| **FEFO (First Expiry First Out)** | ✅ | ⚠️ (manual) | ❌ | CUDII SUPERIOR |
| **Mermas/shrinkage** | ✅ | ✅ | ✅ | — |
| **Historial de precios** | ❌ (schema sin uso) | ✅ | ✅ | FALTA |
| **Gestión de clientes/CRM** | ❌ (schema preparado) | ✅ (profiles, notas) | ✅ (customer directory) | **CRÍTICO FALTANTE** |
| **Programa de lealtad** | ❌ | ✅ (nativo) | ✅ (Square Loyalty) | FALTA |
| **Órdenes online** | ❌ | ✅ (nativo, 0% comisión) | ✅ (Square Online) | FALTA |
| **KDS (Kitchen Display)** | ❌ | ✅ (nativo) | ✅ (3rd party) | N/A (tienda, no restaurante) |
| **Reportes avanzados** | ⚠️ (3 básicos) | ✅ (Toast IQ + AI) | ✅ (COGS, sell-through) | **MEJORAR** |
| **Reportes con IA** | ❌ | ✅ (Toast IQ) | ⚠️ (limitado) | FALTA |
| **Gestión de empleados** | ⚠️ (solo CRUD) | ✅ (payroll, scheduling) | ✅ (Square Payroll) | FALTA |
| **Nómina** | ❌ | ✅ ($13/empleado) | ✅ (Square Payroll) | FALTA |
| **Almacén offline** | ❌ | ✅ (mejor del mercado) | ⚠️ (limitado) | FALTA |
| **Códigos de barras** | ❌ | ✅ (escaneo) | ✅ (escaneo + print) | FALTA |
| **Etiquetas de precio** | ❌ | ⚠️ | ✅ (print labels) | FALTA |
| **Alertas de stock bajo** | ⚠️ (endpoint existe, sin UI push) | ✅ | ✅ | **MEJORAR** |
| **Cuentas por cobrar** | ❌ | ❌ | ✅ (Invoices) | FALTA |
| **Gestión de proveedores** | ✅ (API, sin UI) | ✅ (xtraCHEF) | ✅ (purchase orders) | UI FALTANTE |
| **Órdenes de compra** | ⚠️ (GRN, sin PO previo) | ✅ | ✅ | MEJORAR |
| **Descuentos/promociones** | ⚠️ (solo en venta) | ✅ (happy hour, combos) | ✅ (promotions) | FALTA |
| **Gift cards** | ❌ | ✅ (físicas + digitales) | ✅ | FALTA |
| **Marketing (email/SMS)** | ❌ | ✅ (Toast IQ Grow) | ✅ (Square Marketing) | FALTA |
| **API abierta** | ✅ (REST completa) | ⚠️ (200 integraciones) | ✅ (API completa) | — |
| **Modo offline** | ❌ | ✅ (best-in-class) | ⚠️ | **CRÍTICO FALTANTE** |

### 5.2 Posiciones de CUDII

**Ventajas competitivas de CUDII:**
1. **Multi-tenant nativo** — Toast y Square son single-tenant; CUDII soporta múltiples empresas
2. **FEFO automático** — Asignación inteligente de lotes por caducidad; Toast es manual
3. **Schema de trazabilidad completo** — Lotes, mermas, historial de stock, devoluciones con motivos

**Gaps críticos (deben cerrarse para ser competitivo):**
1. **Gestión de clientes/CRM** — Sin esto no hay fidelización ni reportes por cliente
2. **Almacenamiento offline** — Toast destaca por esto; CUDII falla si se corta internet
3. **Reportes avanzados** — Solo 3 reportes básicos vs. decenas en Toast/Square
4. **Códigos de barras** — Escaneo y generación de etiquetas es estándar mínimo
5. **Protección de rutas frontend** — Rutas protegidas sin usar consistentemente

---

## 6. RECOMENDACIONES PRIORIZADAS

### 🔴 PRIORIDAD ALTA (Hacer ahora)

| # | Recomendación | Esfuerzo | Impacto |
|---|--------------|----------|---------|
| 1 | **Envolver ventas en `prisma.$transaction()`** | Bajo | Previene datos inconsistentes |
| 2 | **Rate limit en `/auth/login`** | Bajo | Previene brute force |
| 3 | **Proteger rutas frontend** con ProtectedRoute | Bajo | Seguridad inmediata |
| 4 | **Vista de Proveedores** (CRUD completo) | Bajo | API ya existe |
| 5 | **Eliminar entidades no usadas** (Notificacion, CodigoQR, HistorialPrecio si no se implementará) | Bajo | Limpieza del schema |

### 🟡 PRIORIDAD MEDIA (Sprint siguiente)

| # | Recomendación | Esfuerzo | Impacto |
|---|--------------|----------|---------|
| 6 | **Módulo de Clientes** (schema + backend + frontend) | Medio | CRM mínimo viable |
| 7 | **Reportes avanzados** (ventas por cliente, productos top, tendencias, COGS) | Medio | Decisiones de negocio |
| 8 | **Códigos de barras** (generación + escaneo) | Medio | Velocidad de checkout |
| 9 | **Alertas de stock bajo** (notificaciones push o email) | Medio | Prevención de quiebres |
| 10 | **Historial de precios** (implementar o eliminar) | Bajo | Trazabilidad de costos |

### 🟢 PRIORIDAD BAJA (Futuro)

| # | Recomendación | Esfuerzo | Impacto |
|---|--------------|----------|---------|
| 11 | **Modo offline** (IndexedDB + sync) | Alto | Resiliencia |
| 12 | **Paginación** en listados | Medio | Escalabilidad |
| 13 | **Helmet + validación .env** | Bajo | Seguridad HTTP |
| 14 | **Tests unitarios** (Jest) | Alto | Calidad |
| 15 | **Órdenes de compra** (PO antes de GRN) | Medio | Flujo completo compras |
| 16 | **Descuentos/promociones** programables | Medio | Marketing |
| 17 | **Gift cards** | Alto | Ingresos adicionales |
| 18 | **Marketing (email/SMS)** | Alto | Fidelización |

### ❌ ENTIDADES A ELIMINAR

| Modelo | Razón |
|--------|-------|
| `CodigoQR Pedido` | Sin uso en ningún módulo; funcionalidad no requerida para POS de tienda física |
| `Notificacion` | Tabla vacía; frontend no consume; si no se implementará尽快, eliminar |
| `HistorialPrecioProducto` | Sin uso; o se implementa (INSERT antes de UPDATE en products) o se elimina |

---

## 7. VEREDICTO FINAL

**CUDII POS es un POS funcional y bien estructurado para una tienda de conveniencia pequeña-mediana.** Su arquitectura multi-tenant, RBAC completo, y sistema de trazabilidad con FEFO lo diferencian de soluciones genéricas.

**Nivel actual vs. mercado:** ~40% de funcionalidad de un POS como Toast o Square. Los gaps principales son CRM, reportes, offline, y códigos de barras — todos estándar en el mercado.

**Prioridad inmediata:** Cerrar los 5 gaps de prioridad alta (transacciones, rate limiting, rutas protegidas, vista proveedores, limpieza de schema) para tener un POS robusto y seguro.

**Siguiente milestone:** Módulo de Clientes + Reportes avanzados → llega a ~55% de cobertura funcional.
