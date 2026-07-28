# CUDII - Plan de Desarrollo y Roadmap

Este documento establece la estrategia y las fases de desarrollo para la plataforma CUDII POS. El desarrollo se divide en un Minimum Viable Product (MVP - V1.0) para la salida rápida a mercado, seguido de iteraciones (V2.0, V3.0) para funcionalidades avanzadas.

---

## Estrategia de Pruebas (Testing)

Para garantizar la calidad y reducir errores en producción, el desarrollo de CUDII implementa la siguiente estrategia:

1. **Pruebas al final de cada tarea/commit:** Cada nueva funcionalidad o corrección debe acompañarse de sus respectivas pruebas unitarias (Unit Tests) utilizando Jest o Vitest, validando que el módulo o clase funcione correctamente.
2. **Fase de Testing Global del SaaS:** Al finalizar cada gran fase (ej. antes de liberar la V1.0), se abrirá una sub-fase dedicada enteramente a QA. Esto incluye:
   - **Pruebas de Integración (Integration Tests):** Validar la comunicación entre NestJS, PostgreSQL y Redis (usando bases de datos de prueba en Docker).
   - **Pruebas E2E (End-to-End):** Validar flujos completos (ej. abrir caja, cobrar producto, cerrar caja) usando herramientas como Cypress o Playwright.
   - **Pruebas de Carga:** Validar que el servidor soporte la concurrencia esperada.

---

## Fases de Desarrollo

### Fase 1: MVP - CUDII V1.0 (Core POS SaaS)
*Objetivo:* Obtener una versión estable y lista para que los primeros comercios locales puedan operar con las funciones esenciales.

**Entregables:**
- **Infraestructura:** (Completado) Entorno Dockerizado (NestJS, Prisma, PostgreSQL, Redis) con soporte de volúmenes para hot-reloading local.
- **Backend & BD:** (Completado) Modelo Multitenant (Empresa, Sucursal, Caja), Autenticación RBAC (JWT), y control de inventario local.
- **Frontend & App:** Aplicación Web (Vite + React) para administración y Cajero. *(Enfoque en Diseño Premium y filosofía Stitch de Google para evitar el aspecto de SaaS genérico).*
- **Flujos Core:** 
  - Onboarding asistido (Día 0).
  - Venta de productos con unidades de medida múltiples (Pieza, Granel, Caja, etc.).
  - Corte de caja X/Z (ciego y abierto).
  - Gestión de Devoluciones y Cambios básicos.
- **Testing V1.0:** Ejecución de pruebas unitarias y E2E de flujos críticos de cobro e inicio de sesión antes del lanzamiento.

### Fase 2: CUDII V2.0 (Inteligencia, Crédito y Compras)
*Objetivo:* Robustecer la plataforma para negocios medianos y fidelizar con funciones avanzadas.

**Entregables:**
- Integración de Módulo de Crédito y Fiados (Estado de cuenta, límite de crédito).
- Órdenes de compra automatizadas y reabastecimiento.
- IA Conversacional básica en Dashboard para consultas operativas (Chatbot LLM + Adaptador).
- Dashboard Temporal Visual (gráficos de histórico de precios y ventas).
- Migración asistida con IA para cargar catálogos masivos.
- **Testing V2.0:** Pruebas de integración enfocadas en cálculos de saldo y seguridad en límites de crédito.

### Fase 3: CUDII V3.0 (Expansión y Especialización)
*Objetivo:* Atacar giros de negocio especializados y cumplir obligaciones fiscales complejas.

**Entregables:**
- Módulo CFDI 4.0 (Facturación en mostrador y Autofacturación por ticket).
- Módulo Restaurantes (Mapa de mesas, comandas, KDS).
- Soporte Offline parcial (Deuda Técnica) usando arquitecturas PWA y sincronización asíncrona local para mitigar caídas eléctricas o de internet.
- **Testing V3.0:** Pruebas rigurosas de simulación de caídas de red y cuadratura fiscal.

---

*Nota: Todas las implementaciones de integraciones externas (PAC de facturación, pasarelas de pago, IA) se construirán usando el Patrón Adapter/Strategy para asegurar que sean fácilmente reemplazables.*

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
