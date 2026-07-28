# Plan de Trabajo - Fase 1: MVP - CUDII V1.0 (Core POS SaaS)

Este documento detalla las tareas secuenciales para completar la Fase 1 del proyecto CUDII, basándose en la especificación de `PLAN_DESARROLLO.md`. 
**Regla estricta:** No se puede avanzar a la siguiente tarea sin haber implementado, validado y confirmado como funcional la tarea actual.

## 1. Configuración de Infraestructura y Entorno
- [x] **Tarea 1.1:** Crear entorno Dockerizado (`docker-compose.yml`).
  - **Descripción:** Configurar los servicios base: PostgreSQL, Redis y la estructura para el backend NestJS y frontend Vite.
  - **Criterios de validación:** El comando `docker-compose up -d` levanta todos los contenedores sin errores.
  - **Verificación manual:** Conectarse a la BD PostgreSQL y Redis asegurando que los puertos están expuestos unicamente para la red Docker y las credenciales son correctas.
- [x] **Tarea 1.2:** Configurar hot-reloading local con volúmenes.
  - **Descripción:** Ajustar volúmenes en Docker para que los cambios en el código local de NestJS y React se reflejen automáticamente en el contenedor.
  - **Criterios de validación:** Los cambios en archivos locales son detectados y recargan los servicios.
  - **Verificación manual:** Modificar un archivo `.ts` en NestJS y verificar en logs que el servicio se reinicia; modificar un componente en Vite y verificar HMR en el navegador.

## 2. Base de Datos y Backend Core
- [x] **Tarea 2.1:** Definir y migrar el Modelo Multitenant (Prisma).
  - **Descripción:** Crear el esquema Prisma con las entidades base: Tenant (Empresa), Sucursal, Caja (Terminal), Usuario, y Producto.
  - **Criterios de validación:** Migración inicial creada (`prisma migrate dev`) y tablas generadas en PostgreSQL con tipado estricto.
  - **Verificación manual:** Revisar el esquema generado en Prisma Studio o DBeaver, validando relaciones lógicas y llaves foráneas.
- [x] **Tarea 2.2:** Implementar Autenticación RBAC y JWT.
  - **Descripción:** Desarrollar login, generación de JWT y guards/decoradores en NestJS para validar roles.
  - **Criterios de validación:** Endpoints protegidos devuelven `401/403` si no hay token o los permisos son insuficientes.
  - **Verificación manual:** Probar el endpoint de login vía Postman/cURL, obtener el token y realizar una petición a un endpoint protegido verificando la respuesta correcta.
- [x] **Tarea 2.3:** CRUD de Inventario Local.
  - **Descripción:** Endpoints para crear, leer, actualizar y hacer soft-delete de productos, soportando múltiples unidades de medida.
  - **Criterios de validación:** Operaciones funcionales, manejo de errores y logs centralizados implementados. Prohibido el `DELETE` físico.
  - **Verificación manual:** Crear un producto por API, listarlo y probar su borrado lógico, verificando que el registro se marque como inactivo en la base de datos pero siga existiendo.

## 3. Frontend y Arquitectura Web
- [x] **Tarea 3.1:** Setup de Aplicación Web (Vite + React + TailwindCSS).
  - **Descripción:** Inicializar el frontend, configurar TailwindCSS (obligatorio) y el enrutador.
  - **Criterios de validación:** La app compila sin errores y los estilos globales están aplicados.
  - **Verificación manual:** Abrir el navegador en el puerto correspondiente, verificar que la pantalla carga y que las clases base de Tailwind funcionan.

## 4. Flujos Core (Lógica de Negocio)
- [ ] **Tarea 4.1:** Implementar Onboarding Asistido (Día 0).
  - **Descripción:** Flujo que precarga una sucursal, caja, catálogo demo y usuario inicial para asegurar operación en menos de 15 minutos.
  - **Criterios de validación:** Al ejecutar el onboarding, se crean todos los registros necesarios de forma atómica.
  - **Verificación manual:** Ejecutar el wizard desde la UI y validar en BD que la Empresa, Sucursal, Caja, Usuario y Productos demo fueron generados.
- [ ] **Tarea 4.2:** Flujo de Venta y Cobro.
  - **Descripción:** Interfaz del Cajero para buscar productos, agregarlos al ticket (calculando por unidad de medida) y registrar el pago (efectivo/tarjeta).
  - **Criterios de validación:** Ventas registradas correctamente en BD con método de pago, vinculadas a la caja y usuario.
  - **Verificación manual:** Realizar ventas de prueba en la UI, simulando cobros; verificar en la BD el ticket, importes y deducción de stock.
- [ ] **Tarea 4.3:** Corte de Caja X/Z (Ciego y Abierto).
  - **Descripción:** Lógica para abrir turnos, ingresar fondo inicial, registrar retiros parciales y cierres de caja.
  - **Criterios de validación:** El histórico se guarda inmutable con la información de la operación.
  - **Verificación manual:** Abrir caja, realizar ventas y ejecutar un cierre (ciego/abierto). Revisar el histórico y cuadre en BD.
- [ ] **Tarea 4.4:** Gestión de Devoluciones y Cambios básicos.
  - **Descripción:** Flujo para devolver un producto de un ticket previo, gestionando separación (stock vs merma) y ajuste en caja (egreso).
  - **Criterios de validación:** Se restaura el inventario adecuadamente y se registra el egreso para mantener la integridad de la caja.
  - **Verificación manual:** En la UI, procesar devolución sobre un ticket previo, regresando al inventario general y verificando el registro del reembolso.

## 5. Pruebas y Lanzamiento (Testing V1.0)
- [ ] **Tarea 5.1:** Pruebas Unitarias de flujos críticos.
  - **Descripción:** Escribir Unit Tests (Jest/Vitest) para servicios esenciales (Cálculo de totales, autenticación).
  - **Criterios de validación:** Tests pasan exitosamente.
  - **Verificación manual:** Ejecutar `npm run test` en backend/frontend y confirmar cobertura e integridad.
- [ ] **Tarea 5.2:** Pruebas E2E (End-to-End).
  - **Descripción:** Pruebas automatizadas (Cypress/Playwright) simulando el login y un cobro completo.
  - **Criterios de validación:** El flujo se completa sin intervención y sin fallos.
  - **Verificación manual:** Correr el script E2E, observando la interfaz automática completar un flujo feliz.
