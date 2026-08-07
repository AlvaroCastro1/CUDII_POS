# Fase 1 — Fundación e Infraestructura

> **Estado:** ✅ COMPLETADA  
> **Versión objetivo:** MVP Base  
> **Dependencia de:** ninguna (es la fase inicial)  
> **Produce para:** Fase 2

---

## Objetivo

Establecer los cimientos técnicos completos sobre los que se construirá todo el sistema CUDII:
- Entorno reproducible con Docker
- Esquema de base de datos multitenant
- Autenticación JWT con RBAC
- Onboarding asistido (Día 0)
- UI de Login y Wizard de Alta

Al finalizar esta fase, debe ser posible registrar una empresa nueva, autenticarse con un usuario y ver el sistema con datos demo, pero sin pantallas de administración ni terminal de caja operativa.

---

## Alcance

**Incluido:**
- Configuración de Docker Compose (PostgreSQL, Redis, NestJS, Vite)
- Hot-reloading local con volúmenes Docker
- Esquema Prisma con entidades base: `Empresa`, `Sucursal`, `Caja`, `Usuario`, `Producto`, `PrecioPorUnidad`, `InventarioSucursal`, `MovimientoInventario`
- Módulo de autenticación: login, generación JWT, guards por rol
- Módulo de Onboarding: wizard de alta guiada con catálogo demo precargado
- Diseño premium de UI (sistema de diseño base)
- Pantallas: `LoginView`, `OnboardingView`, `DashboardView` (placeholder)

**No incluido:**
- CRUD de productos, categorías ni usuarios (eso es Fase 2)
- Terminal de caja operativa (Fase 3)
- Cualquier integración externa (pagos, CFDI, IA)

---

## Prerequisitos

- Node.js ≥ 18 instalado en la máquina de desarrollo
- Docker Desktop instalado y en ejecución
- Repositorio clonado localmente

---

## Entradas

Esta es la fase inicial. No consume entregables de fases anteriores.

**Documentos de referencia a leer antes de iniciar:**
- `AGENTS.md` — roles de IA y reglas de oro
- `SPEC.md` — arquitectura multitenant y stack
- `BACKEND_STANDARDS.md` — estructura de módulos NestJS
- `FRONTEND_STANDARDS.md` — convenciones React/Vite
- `DESIGN_SYSTEM.md` — sistema de diseño visual
- `REGLAS_NEGOCIO.md` sección 16 — Onboarding Día 0

---

## Actividades

### A1 — Configuración del Entorno Docker

**Qué hacer:** Crear el archivo `docker-compose.yml` raíz con servicios: `postgres`, `redis`, `backend` (NestJS), `frontend` (Vite).

**Cómo:** 
- PostgreSQL 15 con volumen persistente para datos.
- Redis 7 como servicio de caché y sesiones.
- Backend con volumen montado en `./backend:/app` y comando `npm run start:dev` para hot-reload.
- Frontend con volumen montado en `./frontend:/app` y comando `npm run dev`.
- Variables de entorno centralizadas en archivo `.env`.

**Buenas prácticas:**
- Nunca hardcodear contraseñas en `docker-compose.yml`. Usar `${VARIABLE}` desde `.env`.
- Crear `.env.example` con todas las variables requeridas pero sin valores sensibles.
- El backend no debe exponer PostgreSQL ni Redis al exterior; solo internamente en la red Docker.

**Riesgos:**
- Conflicto de puertos locales → usar puertos no estándar (5433 para Postgres, 6380 para Redis).
- Hot-reload no funciona en Windows con volúmenes → verificar configuración de `CHOKIDAR_USEPOLLING=true`.

**Resultado esperado:** `docker-compose up -d` levanta los 4 servicios sin errores. El frontend responde en `http://localhost:5173` y el backend en `http://localhost:3000`.

---

### A2 — Esquema de Base de Datos (Prisma)

**Qué hacer:** Definir el `schema.prisma` completo con todas las entidades base del sistema.

**Entidades a crear:**

| Modelo | Campos clave |
|--------|-------------|
| `Empresa` | id, nombre, rfc, estaActivo, timestamps |
| `Sucursal` | id, empresaId, nombre, dirección, estaActivo |
| `Caja` | id, sucursalId, nombre, codigo, estaActivo |
| `Usuario` | id, empresaId, nombre, email, passwordHash, rol, estaActivo |
| `Producto` | id, empresaId, codigoBarras, nombre, unidadMedida, esGranel, precioCompra, precioVentaBase, estaActivo |
| `PrecioPorUnidad` | id, productoId, unidad, precio, cantidadMinima, esDefault |
| `InventarioSucursal` | id, productoId, sucursalId, stockActual, stockMinimo, stockMaximo |
| `MovimientoInventario` | id, productoId, sucursalId, tipo, cantidad, stockAnterior, stockNuevo, usuarioId |

**Enum `Rol`:** `SUPER_ADMIN`, `ADMIN`, `GERENTE`, `CAJERO`, `ALMACEN`, `CONTADOR`

**Enum `TipoMovimientoInventario`:** `venta`, `devolucion_venta`, `ajuste_positivo`, `ajuste_negativo`, `traspaso_salida`, `traspaso_entrada`, `compra`, `apertura_inicial`

**Cómo:**
- Ejecutar `npx prisma migrate dev --name init_base` para crear la migración inicial.
- Usar UUIDs (`@default(uuid())`) como PK en todas las entidades.
- Aplicar `@updatedAt` en todos los campos de timestamp de actualización.

**Buenas prácticas:**
- Nunca editar archivos de migración generados. Si hay un error, crear una nueva migración.
- Usar `@@unique` para combinaciones únicas (ej: `[sucursalId, productoId]` en `InventarioSucursal`).

**Riesgos:**
- Agregar entidades en fases futuras puede requerir migraciones que alteren tablas existentes → diseñar con campos opcionales (`?`) donde sea lógico.

**Resultado esperado:** `npx prisma studio` muestra las tablas generadas. `npx prisma migrate status` no reporta migraciones pendientes.

---

### A3 — Módulo de Autenticación (auth)

**Qué hacer:** Implementar el módulo `auth` en NestJS con login, generación de JWT y guards de roles.

**Archivos a crear:**
```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── jwt.strategy.ts
├── roles.guard.ts
├── roles.decorator.ts
└── dto/
    └── login.dto.ts
```

**Cómo:**
- `POST /auth/login` recibe `{ email, password }`, valida contra BD con bcrypt, devuelve JWT firmado.
- El JWT incluye en el payload: `{ sub: userId, empresaId, rol }`.
- El guard `RolesGuard` lee el decorador `@Roles(Rol.ADMIN, Rol.CAJERO)` y valida contra el rol del JWT.
- Configurar el JWT con expiración de 8 horas (configurable por variable de entorno).

**Buenas prácticas:**
- No almacenar el JWT en `localStorage`. Usar `httpOnly cookies` o `memory` (decisión según `FRONTEND_STANDARDS.md`).
- El `passwordHash` nunca se devuelve en respuestas de API.
- Registrar en auditoría: login exitoso y fallido (con IP y user agent).

**Riesgos:**
- Refresh tokens no implementados en Fase 1 → el usuario debe re-autenticarse cada 8h. Aceptable para MVP.

**Resultado esperado:** `POST /auth/login` devuelve 200 + JWT válido. Una petición a un endpoint protegido con `@Roles(Rol.ADMIN)` desde un usuario con rol `CAJERO` devuelve 403.

---

### A4 — Módulo de Onboarding

**Qué hacer:** Implementar el endpoint que inicializa un nuevo tenant de forma atómica: crea `Empresa`, `Sucursal`, `Caja`, `Usuario Admin` y un catálogo demo.

**Archivo:** `src/modules/onboarding/onboarding.service.ts`

**Cómo:**
- `POST /onboarding/initialize` recibe los datos del wizard y ejecuta un `prisma.$transaction([...])` con todos los registros necesarios.
- El catálogo demo se carga desde un archivo de datos estático (`seeds/catalogo-demo.ts`) con productos reales por giro de negocio.
- Si cualquier parte de la transacción falla, se revierten todos los cambios (ACID).
- Al completarse, el endpoint devuelve el JWT del usuario Admin recién creado.

**Riesgos:**
- Transacciones largas pueden causar timeout → mover el catálogo masivo a un job asíncrono (Fase 2 mejora).

**Resultado esperado:** Al ejecutar el wizard desde el frontend, se crean todos los registros. Verificable con Prisma Studio o DBeaver.

---

### A5 — Frontend Base y Diseño Premium

**Qué hacer:** Inicializar Vite + React, configurar TailwindCSS y construir `LoginView` y `OnboardingView`.

**Cómo:**
- Instalar fuentes premium de Google Fonts (Inter o la definida en `DESIGN_SYSTEM.md`).
- Configurar el tema de TailwindCSS con las variables del sistema de diseño (colores, radios, sombras).
- Implementar toggle de modo claro/oscuro (almacenar preferencia en `localStorage`).
- `LoginView`: campos email/password, toggle de visibilidad de contraseña, botón de login.
- `OnboardingView`: wizard paso a paso (mínimo 5 pasos según `REGLAS_NEGOCIO.md` sección 16).
- `DashboardView`: placeholder con sidebar de navegación y estructura del layout.

**Buenas prácticas:**
- Seguir estrictamente `DESIGN_SYSTEM.md`: áreas táctiles mínimas de 48×48px, paleta de colores definida, micro-animaciones en hover.
- Nunca usar valores hardcodeados de color fuera del tema Tailwind.

**Resultado esperado:** El frontend compila sin errores. El login funciona y redirige al Dashboard. El Onboarding completa el registro de un nuevo tenant.

---

## Entregables

Al finalizar la Fase 1, los siguientes artefactos deben existir en el repositorio:

- [ ] `docker-compose.yml` con 4 servicios funcionales
- [ ] `.env.example` con todas las variables documentadas
- [ ] `backend/prisma/schema.prisma` con todas las entidades base
- [ ] `backend/prisma/migrations/` con la migración inicial
- [ ] `backend/src/modules/auth/` — módulo completo
- [ ] `backend/src/modules/onboarding/` — módulo completo
- [ ] `backend/seed.js` — seed del usuario super admin
- [ ] `frontend/src/views/LoginView.tsx` — con toggle de contraseña y modo oscuro
- [ ] `frontend/src/views/OnboardingView.tsx` — wizard completo
- [ ] `frontend/src/views/DashboardView.tsx` — layout con sidebar

---

## Validaciones

### Pruebas funcionales
1. Ejecutar `docker-compose up -d` → todos los contenedores en estado `Up`.
2. `GET http://localhost:3000/` → responde 200.
3. `POST /auth/login` con credenciales válidas → responde 200 + JWT.
4. `POST /auth/login` con contraseña incorrecta → responde 401.
5. Ejecutar el wizard de Onboarding completo desde el navegador → verificar en Prisma Studio que se crearon `Empresa`, `Sucursal`, `Caja`, `Usuario` y al menos 3 `Producto`.
6. Navegar a una ruta protegida sin token → redirige a `/login`.

### Pruebas técnicas
1. `npx prisma migrate status` → no hay migraciones pendientes.
2. `docker-compose logs backend` → no hay errores de arranque.
3. La contraseña en la BD tiene hash bcrypt (no es texto plano).

### Criterios de calidad
- La UI del Login y Onboarding cumple los criterios visuales del `DESIGN_SYSTEM.md`.
- No hay errores de TypeScript (`tsc --noEmit` pasa sin errores).
- No hay `any` en el código TypeScript.

---

## Criterios de Salida

La Fase 1 está **terminada** cuando:

- [x] `docker-compose up -d` levanta todos los servicios sin error.
- [x] La migración inicial de Prisma está aplicada y verificada.
- [x] `POST /auth/login` devuelve JWT válido.
- [x] El wizard de Onboarding crea todos los registros en la BD de forma atómica.
- [x] El frontend carga correctamente con diseño premium.
  - [x] No hay errores de TypeScript en el proyecto.

---

## Pruebas y Desarrollo (E2E & Seed)

Para garantizar la estabilidad de la Fase 1 y facilitar el desarrollo, el sistema cuenta con:

### 1. Gestión de Datos Demo (Seed)
Para facilitar las pruebas sin ensuciar la lógica de negocio de producción, todo el catálogo demo (usuarios, productos, categorías e inventario inicial) ha sido consolidado en el archivo `backend/prisma/seed.ts`.
- **Uso en Desarrollo:** Para cargar estos datos en la base de datos de Docker, ejecuta:
  ```bash
  docker exec cudii_api npx prisma db seed
  ```
- **Advertencia:** Este comando **NO debe ejecutarse en producción** a menos que se desee reiniciar el catálogo demostrativo, ya que inyecta usuarios genéricos y productos de muestra.

### 2. Pruebas End-to-End (E2E)
Se construyeron suites de pruebas que validan el comportamiento real de los endpoints (levantando la BD) enfocadas en la seguridad (RBAC) y el CRUD:
- **Ejecución:**
  ```bash
  docker exec cudii_api npm run test:e2e
  ```
- **Cobertura Principal:**
  - `roles.e2e-spec.ts`: Verifica que los Cajeros no puedan acceder a listas restringidas, que los Administradores tengan acceso, y que nadie pueda mutar (editar/borrar) a un `SUPER_ADMIN`.
  - `crud.e2e-spec.ts`: Valida que los endpoints POST y GET de `/categories` y `/products` respondan exitosamente y persistan datos.

---

## Dependencias para la Fase 2

La Fase 2 consume directamente los siguientes artefactos producidos en Fase 1:

| Artefacto | Cómo lo usa Fase 2 |
|-----------|-------------------|
| `schema.prisma` con `Empresa`, `Sucursal`, `Usuario`, `Producto` | Agrega los modelos `Categoria`, `HistorialPrecioProducto` sobre el schema existente |
| Módulo `auth` + `RolesGuard` + `@Roles()` | Protege todos los endpoints de administración con `@Roles(Rol.ADMIN, Rol.GERENTE)` |
| Layout del Dashboard con Sidebar | Agrega las nuevas rutas de administración al menú de navegación |
| Convenciones de DTOs y módulos NestJS | Replica la estructura en los nuevos módulos `products`, `categories`, `inventory`, `users` |
| Migración Prisma `init_base` | La Fase 2 crea migraciones adicionales que extienden el schema sin romper la base |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Hot-reload no funciona en volúmenes Docker en Windows | Agregar `CHOKIDAR_USEPOLLING=true` en variables de entorno del contenedor |
| La transacción de onboarding es demasiado larga y hace timeout | Mover la inserción del catálogo demo a un job asíncrono con Bull/Redis |
| Inconsistencia entre el esquema Prisma y la migración | Siempre ejecutar `prisma migrate dev` después de cualquier cambio al schema; nunca editar migraciones manualmente |
| El JWT expirado no redirige al login | Implementar un interceptor HTTP en el frontend que detecte 401 y redirija |
