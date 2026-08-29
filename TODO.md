# Control de Tareas - CUDII

## Fase 1
- [x] Fase 1 Completada y Validada (Infraestructura, Auth, Base de Datos Multitenant)

## Tareas Pendientes / Mejoras Futuras (Backlog)
- [ ] **Polishing Onboarding & Login:** Conectar enlace de registro desde el Login, probar flujo completo de Onboarding desde el navegador y normalizar diseño visual (UI/UX).
- [x] **Historial de Mi Perfil:** Extender la vista de `/admin/perfil` para mostrar un log/histórico de la actividad del usuario (inicios de sesión, ventas, devoluciones, cortes, etc.). Backend: `GET /audit/me` (cualquier usuario autenticado ve sus propios logs) y registro de `INICIO_SESION` en `auth.service.ts`. Frontend: sección "Historial de Actividad" en `MiPerfilView.tsx` con etiquetas legibles y severidad.
- [x] **Campana de Notificaciones en Frontend:** `NotificationBell.tsx` en `MainLayout` conectada al backend (`GET /notifications`, `GET /notifications/count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`). Contador de no leídas con polling 60s, dropdown/popover con lista paginada, filtro No leídas/Todas, marcar como leída al abrir, "marcar todas como leídas" y estilos Whitelabel claro/oscuro con la tipografía del sitio (font-headline-md / body-md / label-sm).

## Fase 2: Catálogo y Gestión de Inventario
- [x] B1 — Extender Schema Prisma (Categoria, HistorialPrecioProducto)
- [x] B2 — Módulo categories (Backend CRUD)
- [x] B3 — Módulo products (Backend CRUD con historial)
- [x] B4 — Módulo inventory (Backend Ajustes/Movimientos)
- [x] B5 — Módulo users (Backend CRUD y Roles)
- [x] B6 — Panel de Administración (Frontend: Rutas y Vistas)
- [x] **Validación Multi-Sucursal:** Verificado que los modales de Productos, Inventario y Usuarios funcionen aislados por sucursal (`empresaId` / `sucursalId`).

## Fase 3: Terminal POS y Ciclo de Venta Completo
- [x] C1 — Extender Schema Prisma (`SesionCaja`, `Venta`, `DetalleVenta`, `PagoVenta`, `RetiroParcial`, `CorteX`, `CorteZ`, `Devolucion`, `DevolucionProducto`). Migración dev aplicada.
- [x] C2 — Módulo backend `cash-register` (apertura, retiros parciales, Corte X, Corte Z configurable ciego/abierto).
- [x] C3 — Módulo backend `sales` (registro atómico de venta en `prisma.$transaction`, generación de folio por caja `CJ01-000001`, ajuste de inventario permisivo auditado).
- [x] C4 — Módulo backend `returns` (devoluciones parciales/totales con separación stock vs merma).
- [x] C5 — Terminal POS en Frontend (`PosView.tsx`, `ProductSearch`, `ProductGrid`, `CartItem`, `CartSummary`, `CheckoutModal`, `VoucherModal`, `OpenCashRegisterModal`, `CloseRegisterModal`, `CashWithdrawalModal`). Persistencia del carrito en `sessionStorage`.
- [x] C6 — Pantalla de Devoluciones en Frontend (`DevolucionesView.tsx` en `/admin/devoluciones`).
- [x] C7 — Rediseño estético POS bento visual sin imágenes según `code.html`, con soporte Whitelabel claro/oscuro, cliente API unificado y marcación rápida por categorías.
- [x] **Configuración del Sitio (menú de perfil):** Nuevo módulo backend `company-settings` (`GET/PATCH /company-settings`) con RBAC ADMIN/SUPER_ADMIN, nueva vista `ConfiguracionView.tsx` en `/admin/configuracion` para editar el tipo de Corte Z (ciego/abierto) a nivel empresa, item "Configuración del Sitio" en el dropdown de perfil, y modal de Corte Z que muestra el efectivo esperado en modo abierto. Verificado por API (RBAC, validación, ambos modos de corte).

### Validación Fase 3 (cortes + auditoría + notificaciones)
- [x] **Migración `add_audit_notifications_umbral` aplicada** a BD: tablas `LogActividad` y `Notificacion`, `Empresa.umbralFaltanteCritico` (default 50), `CorteZ.tipoDiscrepancia` y `CorteZ.autorizadoPorId`.
- [x] **Corte Z con discrepancias en backend:** `cuadre` (info) / `sobrante` (warning, notas obligatorias) / `faltante` (warning o `critical` si supera el umbral; requiere `autorizadoPorId` de SUPER_ADMIN/ADMIN/GERENTE). Notificaciones a admins/gerentes (`caja_abierta`, `retiro_parcial`, `corte_z_realizado`, `faltante_caja`). Verificado 14/14 por API.
- [x] **Auditoría registrada en `LogActividad`:** `APERTURA_CAJA`, `RETIRO_PARCIAL`, `CORTE_X`, `CORTE_Z` con severidad y payload completo.
- [x] **Fix compilación backend:** `CrearLogDto.detalles` ahora es `Prisma.InputJsonValue` (antes `Record<string, unknown>` impedía compilar y el watcher corría un build viejo).
- [x] **Umbral de faltante configurable:** `company-settings` expone/edita `umbralFaltanteCritico`; `ConfiguracionView` permite ajustarlo (input numérico).
- [x] **Endpoints para el flujo POS:** `GET /cash-register/settings` (modoCorteZ + umbral, roles ADMIN/GERENTE/CAJERO) y `GET /users/authorizers` (lista de autorizadores de la empresa).
- [x] **Histórico de actividad:** `AuditController` (`GET /audit` con filtros accion/severidad/entidadTipo/fechas + paginación, RBAC SUPER_ADMIN/ADMIN/GERENTE) y vista `AuditoriaView.tsx` en `/admin/auditoria` con filtros y tabla paginada.
- [x] **Corte Z en frontend:** `CloseRegisterModal` con diferencia en vivo (cuadre/sobrante/faltante), notas obligatorias cuando hay discrepancia, selector de autorizador para faltantes críticos y pantalla de resumen del resultado.

- [x] **Mejora del Dashboard Personalizable:** Solucionado bloqueo estricto de arrastre cuando la edición está desactivada (`static: !personalizando`), habilitado redimensionamiento interactivo de paneles con `WidthProvider(Responsive)`, implementado layout canónico por defecto con botón "↺ Restaurar predeterminados" y acotamiento de estilos responsivos aislados en `.dashboard-view-container`.

## Fase 4: Fidelización, Crédito y Panel de Control
- [x] D1 — Modelo de datos de clientes: `Cliente`, `CuentaCreditoCliente`, `AbonoCredito`, `NivelLealtad`, `MovimientoPuntos` (migración `20260820000003_add_clientes_credito_lealtad`).
- [x] D2 — Programa de lealtad configurable (migración `20260820000004_add_programa_lealtad_configurable`) + `GET/PATCH /company-settings/lealtad` por rol.
- [x] D3 — Módulo backend `customers`: CRUD, cuenta de crédito/fiado, registrar abono (`PaymentDto`: `monto`+`metodoPago`, opcionales `referencia`/`notas`), saldo pendiente.
- [x] D4 — Módulo backend de clientes en ventas: venta al crédito, cobro de deuda en `CheckoutModal` (referencia "Venta $X · Deuda $Y", sin doble conteo), indicador cliente/público, `VentaDetalleView` con sección de venta a crédito.
- [x] D5 — Canje de puntos FIFO + redondeo r2 + desglose de descuentos en ticket.
- [x] D6 — Dashboard personalizable con react-grid-layout: KPIs, tendencia, métodos de pago, TOP y mini-TODO; rejilla arrastrable/redimensionable solo en modo edición; layout persistido (`preferenciasDashboard.layout`) con auto-save; `generarLayoutDefecto` estable + "↺ Restaurar predeterminados".
- [x] D7 — Modal de detalle de clientes reestructurado (scroll interno, layout fijo) + tooltip de vencimiento + caducidad editable.
- [x] **Migración `20260820000005_add_timestamps_audit` aplicada:** añade `creadoEn`/`actualizadoEn` a 14 tablas (Sucursal, Caja, InventarioSucursal, DetalleVenta, PagoVenta, DetalleVentaLote, SesionCaja, CorteZ, Devolucion, DevolucionProducto, NivelLealtad, MovimientoPuntos, CuentaCreditoCliente, AbonoCredito) para auditoría. Verificado en BD (14/14 columnas presentes).
- [x] **Refactor backend controladores `@Request()` → `@CurrentUser()`:** sales, returns, merma, cash-register (6 métodos) y notifications (4 métodos) con `import type { CurrentUserPayload }` (compatible con `isolatedModules`/`emitDecoratorMetadata`).
- [x] **Fix `suppliers.service.ts`:** `any` → `Prisma.ProveedorWhereInput`.
- [x] **Verificación Fase 4 final:** `tsc --noEmit` limpio en backend y frontend; endpoints clave (dashboard, products, categories, lealtad, customers, audit, suppliers, notifications, sucursales, reports, sales) → HTTP 200 con token real; dashboard PATCH/GET persistencia de `layout` confirmado.

### Validación de seguridad (revisión Fase 4)
- [x] `.env` en `.gitignore` y **no rastreado**; solo `.env.example` (plantilla) versionado — confirmado con `git ls-files`.
- [ ] **Pendiente (menor):** habilitar `strict: true` en `frontend/tsconfig.app.json`.
- [ ] **Pendiente (menor):** mover `@types/react-grid-layout` de `dependencies` a `devDependencies` (es solo de tipos).

### Correcciones de sesión (Fase 4 - post-revisión)
- [x] **#1 Sidebar por rol:** creado `frontend/src/lib/permisos.ts` (mapa central `ROLES_POR_MENU` + helper `puedeVerMenu`; SUPER_ADMIN ve todo); `MainLayout.tsx` filtra secciones/ítems por `user.rol`. `App.tsx` añade `RequireRol` y envuelve las rutas restringidas para alinearse con el backend.
- [x] **Fix página en blanco (runtime):** `MainLayout.tsx` importaba `ClaveMenu` (un tipo TS) junto al valor `puedeVerMenu` en la misma sentencia `import`. Vite/esbuild eliminaba el tipo → `SyntaxError: does not provide an export named 'ClaveMenu'`, rompiendo el montaje de React (todo en blanco). Fix: separar con `import { puedeVerMenu }` + `import type { ClaveMenu }`. Verificado con Chrome headless (el Dashboard renderiza sin errores de consola).
- [x] **#2 Reportes (Error 500) arreglado:** causa raíz en `reports.service.ts` `construirWhereSqlVenta` — `Prisma.join(condiciones)` usaba separador `,` por defecto (error SQL) al pasar `fechaInicio`/`fechaFin`. Fix: `Prisma.join(condiciones, ' ')` + manejo de array vacío con `Prisma.empty`. Verificado: `top-products` y `margin` (por producto/categoría) con rango → HTTP 200.
- [x] **#3 Auditoría de eventos sensibles:** inyectadas llamadas de `AuditService.registrarEvento` en `sales.service.ts` (`VENTA_COMPLETADA` con folio/total/subtotal/impuestos/descuento/método de pago/esDemostración, posterior a la transacción) y en `returns.service.ts` (`DEVOLUCION_REGISTRADA`). `AuditoriaView.tsx` añade ambas acciones a `ACCIONES`/`ACCION_LABEL` y casos legibles en `resumirDetalles`. Verificado end-to-end: crear venta real → log `VENTA_COMPLETADA` visible en `GET /audit` con filter.



## Fase 4.5: Cupones de Descuento
- [x] **Migración 20260828000000_add_cupones aplicada** a BD (workaround manual + migrate resolve --applied): tablas Cupon (16 columnas) y CuponRedencion (6 columnas), columna Venta.descuentoCupon (double default 0). migrate status = up to date.
- [x] **Módulo backend coupons:** CRUD multitenant (GET /coupons, GET /coupons/validar, GET /coupons/:id, POST /coupons, PATCH /coupons/:id, DELETE /coupons/:id) con RBAC (list/validar ADMIN,SUPER_ADMIN,GERENTE,CAJERO; crear/actualizar/detalle ADMIN,SUPER_ADMIN,GERENTE; delete ADMIN,SUPER_ADMIN). validar() chequea existencia, activo, vigencia, soloClientesRegistrados, monto mínimo de compra, límite total y límite por cliente; calcularDescuento() aplica MONTO_FIJO (min(valor, base)) y PORCENTAJE (0-100).
- [x] **Integración en ventas:** CreateVentaDto añade codigoCupon?; sales.service.createSale valida el cupón dentro de la transacción (base = subtotal - descuentos de ítems - descuento general), aplica el descuento en cascada (promo -> cupón -> nivel -> canje), guarda descuentoCupon y la CuponRedencion, y findOneSale incluye cuponRedencion.cupon.
- [x] **Frontend CuponesView.tsx** (/admin/cupones): CRUD completo con búsqueda, modal crear/editar (tipo %/$ , monto mínimo, switch solo clientes registrados, límites total/por cliente, fechas, activo) y columna de usos (_count.redenciones). Registrado en App.tsx, MainLayout.tsx (grupo Administración) y permisos.ts (clave cupones, ROLES ADMIN/GERENTE).
- [x] **Integración en cobro (frontend):** CheckoutModal añade input de código de cupón + botón Aplicar que valida vía GET /coupons/validar, calcula descuentoCupon en el desglose y envía codigoCupon en el payload; se re-valida al cambiar de cliente. VoucherModal y VentaDetalleView reflejan descuentoCupon y el código/cupón de cuponRedencion.
- [x] **Verificación end-to-end:** venta real con cupón PORCENTAJE (descuento 15%) y MONTO_FIJO () -> descuentoCupon correcto, CuponRedencion creada y findOneSale devuelve el cupón; límites total y por cliente rechazados con HTTP 400 y mensajes claros. tsc --noEmit limpio en frontend y backend.
