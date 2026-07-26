# Estándares y Estrategia de Pruebas (Testing)

Este documento centraliza la estrategia de Quality Assurance (QA) para CUDII POS. El objetivo principal es evitar regresiones, mantener alta confiabilidad operativa en la caja y asegurar integridad fiscal/financiera.

---

## 1. Pruebas Unitarias (Unit Tests)

Toda lógica de negocio (cálculo de impuestos, descuentos, algoritmos de stock) DEBE incluir pruebas unitarias.

- **Herramientas:** Jest o Vitest (preferido con Vite).
- **Cobertura Esperada:** Se espera al menos un 80% de cobertura en servicios críticos (Cálculos matemáticos y manipulación de datos financieros).
- **Ejecución:** Obligatoria antes de realizar cualquier commit o PR.
- **Formato:** Archivos adyacentes a la lógica (`ejemplo.service.ts` y `ejemplo.service.spec.ts`).

## 2. Pruebas de Integración

Garantizan que las piezas del sistema funcionen en conjunto correctamente.

- **Herramientas:** Supertest para probar endpoints, Jest/Vitest.
- **Entorno Aislado:** Ejecutar contra una base de datos de prueba en Docker (nunca producción o desarrollo puro) que se levante y se destruya por sesión de pruebas.
- **Casos Comunes:** Validar el flujo HTTP (Middleware -> Guard -> Controller -> Service -> Base de Datos).

## 3. Pruebas End-to-End (E2E)

Simulan la experiencia completa del usuario final desde un navegador web.

- **Herramientas:** Cypress.
- **Flujos Críticos Requeridos (Happy Path):**
  1. Onboarding de Usuario (Día 0).
  2. Inicio de sesión y asignación de turno.
  3. Búsqueda de producto y cobro en efectivo.
  4. Devolución de un producto e impacto en corte de caja.
  5. Cierre de caja X/Z.
- **Entorno:** Se ejecutará un build temporal en un entorno sandbox antes del despliegue en staging.

## 4. Pruebas de Carga (Opcional - Fase 2+)

Para escenarios de alta demanda concurrente (ej. Multiples sucursales operando el Buen Fin).

- **Herramientas:** K6 o JMeter.
- **Objetivo:** Verificar la resiliencia del pool de conexiones PostgreSQL y la latencia del backend bajo carga HTTP masiva.

## 5. Prevención de Flaky Tests

- Evitar depender de tiempos rígidos (`setTimeout`) en pruebas E2E.
- Asegurarse de que el estado inicial de la base de datos sea limpio y determinista (truncado de tablas antes de suite o DB en memoria temporal) para cada prueba de integración.

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
