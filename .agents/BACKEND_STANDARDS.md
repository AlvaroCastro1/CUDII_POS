# Estándares de Programación Backend (NestJS + Prisma)

Este documento define las directrices arquitectónicas y patrones de desarrollo obligatorios para el servidor backend de CUDII.

---

## 1. Stack Tecnológico Core

- **Framework:** NestJS (Node.js).
- **ORM:** Prisma (Tipado estricto y migraciones).
- **Base de Datos:** PostgreSQL.
- **Caché y Colas:** Redis.
- **Lenguaje:** TypeScript (Estricto).

## 2. Arquitectura de Módulos

CUDII sigue una arquitectura modular en NestJS. Cada entidad de negocio pertenece a su propio módulo encapsulado.

```text
src/
├── app.module.ts
├── main.ts
├── common/              # Elementos compartidos (Filtros de Excepciones, Decoradores, Guards)
├── config/              # Configuración (Entorno, TypeORM/Prisma)
└── modules/
    ├── auth/            # JWT, Login, Roles
    ├── tenant/          # Gestión de Empresas (Organización)
    ├── branch/          # Sucursales y configuraciones locales
    ├── pos/             # Flujos de Venta, Arqueos, Caja
    ├── inventory/       # Productos, Categorías, Lotes
    └── adapters/        # Patrón Estrategia (IA, Facturación, Pasarelas)
```

## 3. Reglas de Implementación (SOLID y Clean Architecture)

- **Controladores Finos, Servicios Gruesos:** Los controladores solo deben recibir la petición, validar el DTO y delegar la lógica al servicio.
- **Data Transfer Objects (DTO):** Obligatorio el uso de DTOs con decoradores de `class-validator` para cada request body o query parameter. Prohibido usar `any`.
- **Inyección de Dependencias:** Utilizar siempre el contenedor DI de NestJS. No instanciar clases manualmente con `new` a menos que sea un patrón factoría explícito.
- **Patrón Adaptador:** Cualquier integración de terceros (Facturación PAC, Pasarelas de Pago, Modelos IA) debe implementarse bajo una interfaz abstracta (Ej. `PaymentGatewayInterface`).

## 4. Persistencia de Datos y Prisma

- **Soft Delete:** Obligatorio. Toda eliminación debe ser un update `estaActivo: false` o similar, manteniendo referencias históricas.
- **Transacciones:** Operaciones críticas (ej. Registrar Venta + Descontar Inventario + Registrar Movimiento de Caja) DEBEN ejecutarse dentro de un bloque `$transaction` de Prisma para garantizar atomicidad (ACID).
- **Búsqueda y Paginación:** Usar paginación (Skip/Take) obligatoria en queries de listas masivas.

## 5. Manejo de Errores (Filtro Global)

- Nunca dejar un `catch (error) {}` vacío.
- Utilizar las excepciones HTTP estándar de NestJS (`BadRequestException`, `NotFoundException`, etc.).
- Todo error no controlado debe ser capturado por un Global Exception Filter, el cual registrará el incidente en los logs y devolverá un formato de error estandarizado al frontend.

## Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant . |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `FRONTEND_STANDARDS.md`| [/CUDII_POS/.agents/FRONTEND_STANDARDS.md](/CUDII_POS/.agents/FRONTEND_STANDARDS.md)| Estándares de programación frontend (React/Vite). |
| 5 | `TESTING_STANDARDS.md` | [/CUDII_POS/.agents/TESTING_STANDARDS.md](/CUDII_POS/.agents/TESTING_STANDARDS.md) | Estrategia de Pruebas Unitarias y E2E. |
| 6 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 7 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 8 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 9 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 10 | `Fase1.md` | [/CUDII_POS/.agents/fases/Fase1.md](/CUDII_POS/.agents/fases/Fase1.md) | Plan detallado y checklist secuencial de la Fase 1 (MVP). |
| 11 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |
