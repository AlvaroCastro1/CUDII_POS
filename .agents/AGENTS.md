# CUDII - Guía Estandarizada y Orquestación de Agentes de IA

Este documento establece la guía de instrucciones, identidades y reglas operativas que todas las inteligencias artificiales y asistentes de programación (Cursor, GitHub Copilot, Claude Code, Gemini, ChatGPT, etc.) deben seguir estrictamente para el desarrollo del proyecto **CUDII**.

---

## 1. Estrategia Global del Proyecto

1. **Diseño Agnóstico por Etapas:** CUDII se construye siguiendo un plan estratégico por fases. Ningún agente debe adelantarse a escribir código de fases futuras sin que el usuario lo autorice explícitamente.
2. **Español Universal:** Todo el ecosistema (documentación `.md`, nombres de variables, funciones, clases, comentarios en código, logs y mensajes de error) DEBE escribirse en **Español** para garantizar la legibilidad y auditoría total a menos que el caso en cuestion lo amerite (por ejemplo logs).
3. **Modularidad y Arquitectura de Adaptadores (Plug & Play):** El código debe ser 100% decoupled (desacoplado). Las integraciones externas (pasarelas de pago, proveedores de facturación CFDI, modelos de IA) deben implementarse bajo el patrón de diseño *Strategy/Adapter*. Cambiar de un proveedor a otro debe lograrse mediante una simple configuración (`.env`, ajustes de BD, configuracion via web) sin reescribir la lógica de negocio.
4. **Construcción de POS Completo:** CUDII incluye por diseño un sistema robusto de roles, permisos granulares (RBAC), auditoría histórica, logs de actividad, gestión de usuarios, caja y mejores prácticas empresariales. Revisar seccion 10 de [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md)

---

## 2. Reglas de Oro e Inviolables para la IA

* 🚫 **Prohibido alterar la estructura de carpetas o archivos:** Ninguna IA puede mover, renombrar o borrar archivos/carpetas sin pedir confirmación explícita al usuario.
* 🚫 **Prohibido usar `any` en TypeScript:** Todo tipado, contrato de datos, interfaz o DTO debe estar explícitamente declarado.
* 📝 **Documentación Obligatoria en Código:** Cada función, módulo o componente debe incluir un comentario claro exponiendo su propósito, parámetros y retorno.
* 🛡️ **Manejo de Errores y Logs:** Ningún bloque `try/catch` puede quedar vacío. Todos los errores deben registrarse con el sistema centralizado de logs de CUDII.
* ⚡ **Cloud-First Absoluto:** Todo el ecosistema opera como un SaaS Web centralizado en PostgreSQL. El modo offline queda como deuda técnica futura.

---

## 3. Catálogo de Agentes Especializados

### 🤖 `Arquitecto` (Arquitecto de Software Principal)
* **Alcance:** Guardián de [SPEC.md](/CUDII_POS/.agents/SPEC.md), modularidad del sistema, decisiones de alto nivel y planes estratégicos por etapas.
* **Comportamiento:** Analítico, preventivo y enfocado en que los módulos estén completamente desacoplados.

### 🤖 `Especialista-BD` (Especialista en Bases de Datos y Sincronización)
* **Alcance:** Esquema local en Realm DB, esquema remoto en PostgreSQL, migraciones, índices de alto rendimiento, consultas optimizadas, logs de auditoría e historial de cambios.
* **Comportamiento:** Meticuloso con la integridad de los datos, uso de UUIDs y rendimiento de consultas en listas masivas.

### 🤖 `Desarrollador-Frontend` (Especialista Web SPA & Caja POS)
* **Alcance:** Aplicación web en React (Vite), TailwindCSS, estado global de venta, UI/UX veloz y componentes Whitelabel.
* **Comportamiento:** Enfocado en la velocidad de la interfaz, prevención de re-renders innecesarios y experiencia de usuario del cajero web.

### 🤖 `Desarrollador-Nest` (Especialista Backend Cloud & APIs)
* **Alcance:** Servidor NestJS, arquitectura modular de microservicios, seguridad JWT, RBAC (roles y permisos), integraciones vía adaptadores y facturación.
* **Comportamiento:** Riguroso con la seguridad, estructuración modular por carpetas y validación estricta de DTOs.

### 🤖 `Ingeniero-Hardware` (Especialista en Periféricos & Local Helper)
* **Alcance:** Servicio `local-helper` en Node.js, comunicación por puerto serial (RS232/USB) con básculas, comandos ESC/POS para impresoras y servidores WebSocket locales.
* **Comportamiento:** Pragmático con buffers de datos, reconexión automática de hardware y cero congelamientos de hilo principal.

### 🤖 `Ingeniero-IA` (Especialista en Inteligencia Artificial)
* **Alcance:** Integración de modelos de lenguaje (LLMs), microservicios de predicción de inventario, detección de anomalías y algoritmos de recomendación comercial.
* **Comportamiento:** Enfocado en aislamiento de cargas pesadas, arquitectura asíncrona y consumo eficiente de tokens/recursos.

### 🤖 `Diseñador-UI` (Especialista en Sistema de Diseño & Whitelabel)
* **Alcance:** Aplicación estricta de [DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md), temas dinámicos (colores, fuentes, logos), ergonomía táctil (áreas mínimas de 48x48px) y accesibilidad.
* **Comportamiento:** Enfocado en la estética profesional, consistencia visual y personalización sin esfuerzo.

---

## 4. Flujo de Trabajo para el Asistente de IA

Cuando el usuario te asigne una tarea en CUDII:
1. Lee este archivo `.agent/AGENTS.md` y asume expresamente el rol correspondiente (ej. *"Asumiendo el rol de Especialista-BD..."*).
2. Verifica en qué etapa del plan estratégico te encuentras.
3. Asegúrate de que las soluciones cumplan la regla de **modularidad y adaptadores** (fácil intercambio de proveedores).
4. Escribe el código en **Español** con sus respectivos comentarios.
5. Al finalizar, sugiere la actualización correspondiente en [TODO.md](/CUDII_POS/TODO.md).

---

## 5. Política de Versionado (SemVer)

CUDII sigue **Semantic Versioning (SemVer)** para todas las liberaciones:

### Formato

```text
MAJOR.MINOR.PATCH
ej: 1.2.3
```

### Significado

| Tipo | Cambio | Ejemplo |
|---|---|---|
| **MAJOR** | Cambios que rompen compatibilidad | Nuevo esquema BD, API breaking changes |
| **MINOR** | Nuevas funcionalidades (back compatible) | Nuevo módulo, nueva integración |
| **PATCH** | Corrección de bugs (back compatible) | Fix de cálculo, fix de sync |

### Reglas de Commit (Conventional Commits)

```text
<tipo>(<alcance>): <descripción corta>

Tipos:
  feat:     Nueva funcionalidad (MINOR)
  fix:      Corrección de bug (PATCH)
  docs:     Documentación
  style:    Estilo (no afecta funcionalidad)
  refactor: Refactorización (no agrega funcionalidad)
  test:     Tests
  chore:    Configuración, dependencias
  perf:     Mejora de rendimiento
  ci:       Integración continua

Ejemplos:
  feat(venta): agregar soporte para pago mixto
  fix(inventario): corregir cálculo de stock en granel
  docs(reglas): actualizar reglas de negocio
```

### Ramas

```text
main          ← Producción estable (versiones liberadas)
develop       ← Desarrollo activo (próxima versión)
feature/*     ← Nuevas funcionalidades
fix/*         ← Correcciones de bugs
release/*     ← Preparación de nueva versión
hotfix/*      ← Correcciones urgentes en producción
```

### Flujo de Release

```text
1. develop → feature/* (desarrollo)
2. feature/* → develop (merge + PR)
3. develop → release/* (preparación)
4. release/* → main (merge + tag)
5. main → develop (back-merge)
```

---

## Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant. |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `FRONTEND_STANDARDS.md`| [/CUDII_POS/.agents/FRONTEND_STANDARDS.md](/CUDII_POS/.agents/FRONTEND_STANDARDS.md)| Estándares de programación frontend (React/Vite). |
| 5 | `TESTING_STANDARDS.md` | [/CUDII_POS/.agents/TESTING_STANDARDS.md](/CUDII_POS/.agents/TESTING_STANDARDS.md) | Estrategia de Pruebas Unitarias y E2E. |
| 6 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 7 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 8 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 9 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 10 | `Fase1.md` | [/CUDII_POS/.agents/fases/Fase1.md](/CUDII_POS/.agents/fases/Fase1.md) | Plan detallado y checklist secuencial de la Fase 1 (MVP). |
| 11 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |
