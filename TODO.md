# Control de Tareas - CUDII

## Fase 1
- [x] Fase 1 Completada y Validada (Infraestructura, Auth, Base de Datos Multitenant)

## Tareas Pendientes / Mejoras Futuras (Backlog)
- [ ] **Polishing Onboarding & Login:** Conectar enlace de registro desde el Login, probar flujo completo de Onboarding desde el navegador y normalizar diseño visual (UI/UX).
- [ ] **Historial de Mi Perfil:** Extender la vista de `/admin/perfil` para mostrar un log/histórico de la actividad del usuario (inicios de sesión, ediciones, acciones clave en la plataforma).

## Fase 2: Catálogo y Gestión de Inventario
- [x] B1 — Extender Schema Prisma (Categoria, HistorialPrecioProducto)
- [x] B2 — Módulo categories (Backend CRUD)
- [x] B3 — Módulo products (Backend CRUD con historial)
- [x] B4 — Módulo inventory (Backend Ajustes/Movimientos)
- [x] B5 — Módulo users (Backend CRUD y Roles)
- [x] B6 — Panel de Administración (Frontend: Rutas y Vistas)
- [x] **Validación Multi-Sucursal:** Verificado que los modales de Productos, Inventario y Usuarios funcionen aislados por sucursal (`empresaId` / `sucursalId`).

