# CUDII POS - Plan Detallado Fase 1 (MVP Core POS + Onboarding Día 0)

Este documento desglosa la **Fase 1** en tareas granulares para ejecutarlas paso a paso. La regla estricta es **no avanzar a la siguiente tarea sin la confirmación y validación explícita del usuario**.

La intencion es ir marcando cada una de las tareas o bloques una vez completados. Para poder darle seguimiento despues de cada iteracion y que tenga clara la traza de lo que se ha realizado.

---

## Bloque 1: Base de Datos y Estándares Core

### [x] Tarea 1.0: Documentación de Estándares (Soft Delete y LLM Adapter)
- **Descripción:** Actualizar la documentación arquitectónica (`BACKEND_STANDARDS.md` o un nuevo documento de decisiones) para reflejar:
  1. El uso de **Prisma Client Extensions** para el Soft Delete (en lugar de Middlewares, debido a la deprecación de estos últimos en Prisma 5+).
  2. El patrón **Strategy/Adapter** para el LLM de Migración, que soportará LLM locales y externos configurables mediante `.env` (API KEY, Host).
- **Validación:** El usuario aprueba los textos documentados.

### [x] Tarea 1.1: Implementación del Soft Delete Global (Prisma Extension)
- **Descripción:** Crear el Prisma Client en `packages/database/src/client.ts` configurando la extensión de Prisma que omite registros con `estaActivo: false` en todas las consultas de lectura a menos que se solicite lo contrario.
- **Validación:** Crear un script temporal `test-soft-delete.ts` que inserte un registro inactivo y compruebe que un `findMany` normal no lo retorna.


---

## Bloque 2: Endpoints Core POS (NestJS)  

### [x] Tarea 2.1: CRUD de Empresa y Sucursal
- **Descripción:** Crear controladores y servicios en NestJS para administrar Empresas y Sucursales. Incluir validación obligatoria de `empresaId` desde el JWT (Multitenancy).
- **Validación:** Probar con la interfaz de Swagger y comprobar que la BD almacena los registros correctamente.

### Tarea 2.2: Usuarios y RBAC
- **Descripción:** Implementar el control de roles por sucursal (ADMIN, GERENTE, CAJERO). Modificar Guards de NestJS para validar permisos de acceso.
- **Validación:** Autenticarse en Swagger con distintos roles y comprobar que un CAJERO no puede acceder al endpoint de configuración de empresa.

### Tarea 2.3: CRUD Catálogo de Productos y Categorías
- **Descripción:** Endpoints para productos. Se debe implementar la **trazabilidad**: cualquier cambio en `precioVentaBase`, `precioCompra` o `estaActivo` debe registrar automáticamente una fila en `HistorialCambioEntidad`.
- **Validación:** Actualizar un precio vía Swagger y verificar en base de datos que se generó un log en `historial_cambios_entidad`.

---

## Bloque 3: Frontend Web Base y Whitelabel

### Tarea 3.1: Contexto TemaWhitelabel (React/Vite)
- **Descripción:** En la SPA (`apps/web`), crear `TemaWhitelabelContext` que inyecte variables CSS al `:root` basado en la configuración guardada en BD.
- **Validación:** Modificar manualmente el JSON Whitelabel de una empresa en BD, cargar el frontend y ver los colores cambiar instantáneamente sin recompilar.

### Tarea 3.2: Layout de Interfaz Multirol
- **Descripción:** Estructurar el cascarón de la SPA. Un menú de Dashboard que solo se renderice si el usuario es GERENTE o ADMIN. Si es CAJERO, el sistema lo redirige directo a la Caja.
- **Validación:** Iniciar sesión con un cajero de prueba y constatar que no ve ni puede acceder por URL al dashboard administrativo.

---

## Bloque 4: Operaciones de Caja y Devoluciones (Backend y Frontend)

### Tarea 4.1: Interfaz de Caja (Carrito y Totalizador)
- **Descripción:** Interfaz de punto de venta rápido. Búsqueda de productos, carrito y suma de totales con cálculo de impuestos o descuentos.
- **Validación:** Realizar el flujo visual de agregar productos, modificar cantidades y verificar que el subtotal y total cuadren al centavo.

### Tarea 4.2: Flujo de Pago y Cierre de Venta
- **Descripción:** Implementar modal de cobro (Efectivo/Tarjeta simulada). Descontar inventario (MovimientoInventario) al cerrar la venta.
- **Validación:** Vender 2 unidades de un producto. Comprobar que en BD el `stockActual` se reduce en 2 y se crea el `VentaPago`.

### Tarea 4.3: Devoluciones y Corte Z (Integridad)
- **Descripción:** Flujo para buscar un ticket y devolver productos (a Stock o a Merma). Si el reembolso es en efectivo, se genera un egreso en la caja (Corte Z).
- **Validación:** Devolver 1 producto a stock reembolsado en efectivo. Validar en BD que el `stockActual` suba en 1 y el total de la caja activa disminuya el importe devuelto.

### Tarea 4.4: Impresión ESC/POS
- **Descripción:** Generar comandos ESC/POS para los tickets vía WebSockets (enviados a `local-helper`).
- **Validación:** Simular envío de ticket y visualizar los comandos de bytes (hex) generados en la consola.

---

## Bloque 5: Onboarding Día 0

### Tarea 5.1: Wizard de Alta Guiada y Sembrado Base
- **Descripción:** Pantallas paso a paso para usuario nuevo (Configuración inicial). Opción para precargar catálogo según giro.
- **Validación:** Completar el Wizard seleccionando "Abarrotes" y confirmar que el catálogo de productos se llena con datos demo predefinidos listos para vender.

---

## Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo (este archivo). |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant. |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 5 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 6 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 7 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 8 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |