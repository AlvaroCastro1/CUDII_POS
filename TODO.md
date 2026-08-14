# Control de Tareas - CUDII

## Fase 1
- [x] Fase 1 Completada y Validada (Infraestructura, Auth, Base de Datos Multitenant)

## Tareas Pendientes / Mejoras Futuras (Backlog)
- [ ] **Polishing Onboarding & Login:** Conectar enlace de registro desde el Login, probar flujo completo de Onboarding desde el navegador y normalizar diseño visual (UI/UX).
- [ ] **Historial de Mi Perfil:** Extender la vista de `/admin/perfil` para mostrar un log/histórico de la actividad del usuario (inicios de sesión, ediciones, acciones clave en la plataforma).
- [ ] **Campana de Notificaciones en Frontend:** Conectar la campana estática de `MainLayout` con los endpoints ya existentes del backend (`GET /notifications?soloNoLeidas`, `GET /notifications/count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`). Incluye: contador de no leídas, dropdown/popover con la lista, marcar como leída al abrir, acción "marcar todas como leídas" y estilos Whitelabel claro/oscuro. El backend ya está verificado 14/14.

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

## Pendientes / Mejoras Futuras (Backlog)
- [ ] **Errores de lint preexistentes en backend:** `npm run lint` reporta errores `@typescript-eslint/no-unsafe-*` en módulos de Fase 3 (`auth`, `cash-register`, `sales`, `returns`, e2e tests) y falta de `ValidationPipe` global en `main.ts` (los DTOs no se validan de forma global; solo el módulo `company-settings` valida localmente).
- [ ] **Tests unitarios preexistentes rotos:** Los specs de `categories`, `products`, `users` y `app.controller` fallan por no inyectar `PrismaService` mock (o por assert desactualizado). El spec nuevo `company-settings.service.spec.ts` pasa.



