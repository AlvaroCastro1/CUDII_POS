# Fase 6 — Especialización (V3.0)

> **Estado:** 🔴 PENDIENTE  
> **Versión objetivo:** V3.0  
> **Dependencia de:** Fase 5 (completada)  
> **Produce para:** N/A (última fase del roadmap)

---

## Objetivo

Expandir CUDII a giros de negocio especializados y cumplir con las obligaciones fiscales más complejas del mercado mexicano. Esta fase agrega:

- **Facturación CFDI 4.0** con timbrado real ante el SAT.
- **Módulo de Restaurantes** con mapa de mesas, comandas digitales y pantalla KDS (Kitchen Display System).
- **Integración completa de periféricos** (básculas digitales, impresoras térmicas, cajón de dinero) vía un servicio local (`local-helper`).
- **Soporte offline parcial** mediante PWA para operar durante interrupciones de conectividad.

---

## Alcance

**Incluido:**
- Adaptador PAC para CFDI 4.0 (timbrado, cancelación, notas de crédito)
- Portal de autofacturación para clientes (vía QR en ticket)
- Módulo `restaurant` con modelos: `Mesa`, `Comanda`, `ItemComanda`
- Pantalla KDS (Kitchen Display System) como vista web separada
- Servicio `local-helper` en Node.js (WebSocket + comunicación con hardware)
- Integración de báscula digital (RS232/USB)
- Integración de impresora térmica (ESC/POS)
- Control de cajón de dinero
- PWA con Service Worker para soporte offline parcial de la terminal POS

**No incluido:**
- App móvil nativa (Expo) — pendiente para versiones futuras
- E-commerce integrado — pendiente para versiones futuras
- Soporte offline completo (solo parcial: últimas ventas cacheadas)

---

## Prerequisitos

- Fase 5 completada y validada
- El sistema tiene datos reales de múltiples ventas, clientes y movimientos de inventario
- El negocio cliente tiene credenciales de un PAC (Proveedor Autorizado de Certificación) del SAT para la facturación real

---

## Entradas

| Artefacto de Fase 5 | Uso en Fase 6 |
|--------------------|--------------|
| Adaptador de notificaciones multicanal | Se reutiliza para notificar cuando un CFDI es timbrado o hay un error fiscal |
| Modelo `Venta` con todos sus relaciones | El módulo CFDI lee la venta para construir el XML del comprobante |
| Modelo `Cliente` con `rfc` y `usoCfdi` | Son datos obligatorios para timbrar una factura |
| Módulo `imports` | Se extiende para importar catálogos de clave SAT de productos |
| Patrón Strategy/Adapter | El adaptador PAC sigue exactamente el mismo patrón que el adaptador LLM |

---

## Actividades

### F1 — Adaptador CFDI 4.0 (Backend)

**Qué hacer:** Implementar el módulo de facturación con el patrón Adapter para soportar múltiples PACs.

**Interfaz del Adaptador:**
```typescript
// src/modules/adapters/cfdi/cfdi.adapter.ts
interface CFDIAdapter {
  timbrar(datos: DatosCFDI): Promise<CFDIResultado>;
  cancelar(uuid: string, motivo: string): Promise<boolean>;
  generarPDF(uuid: string): Promise<Buffer>;
  esActivo(): boolean;
}
```

**Adaptadores a implementar:**
- `FacturapiAdapter` — proveedor recomendado para MVP (API REST simple)
- `SWIAdapter` — alternativa robusta para volumen alto
- `MockAdapter` — para demos y testing (no timbra realmente)

**Endpoints:**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/cfdi/invoice` | Timbrar CFDI 4.0 para una venta | ADMIN, CAJERO (con permiso) |
| POST | `/cfdi/:uuid/cancel` | Cancelar CFDI (dentro del periodo permitido) | ADMIN |
| GET | `/cfdi/:uuid/pdf` | Descargar PDF del CFDI | ADMIN, GERENTE |
| GET | `/cfdi/self-invoice/:token` | Portal de autofacturación (público) | Público |

**Reglas de facturación CFDI 4.0:**
- El receptor debe tener: RFC válido, régimen fiscal, código postal, uso CFDI.
- Solo se puede cancelar un CFDI dentro de las primeras 72h si no ha sido aceptado.
- Una venta cancelada con CFDI emitido → generar Nota de Crédito (Egreso) automáticamente.
- Cada ticket no facturado incluye un token único para autofacturación posterior.

**Modelo a agregar:**
```prisma
model CFDI {
  id          String   @id @default(uuid())
  ventaId     String   @unique
  uuid        String   @unique    // UUID del SAT
  folio       String
  serie       String
  xmlUrl      String
  pdfUrl      String?
  estado      EstadoCFDI @default(vigente)
  creadoEn    DateTime @default(now())
  canceladoEn DateTime?
  motivoCancelacion String?
}

enum EstadoCFDI { vigente, cancelado, cancelacion_pendiente }
```

---

### F2 — Módulo `restaurant` (Backend y Frontend)

**Qué hacer:** Implementar el módulo completo para negocios de restaurante o comida.

**Modelos a agregar:**
```prisma
model Mesa {
  id         String   @id @default(uuid())
  sucursalId String
  nombre     String   // "Mesa 1", "Terraza 3", "Barra"
  capacidad  Int
  estado     EstadoMesa @default(disponible)
  comandas   Comanda[]
}

model Comanda {
  id         String   @id @default(uuid())
  mesaId     String
  meseroId   String
  estado     EstadoComanda @default(abierta)
  items      ItemComanda[]
  creadoEn   DateTime @default(now())
  cerradaEn  DateTime?
}

model ItemComanda {
  id         String   @id @default(uuid())
  comandaId  String
  productoId String
  cantidad   Int
  notas      String?       // Modificadores: "sin cebolla", "extra chile"
  estado     EstadoItem @default(pendiente)
  
}

enum EstadoMesa    { disponible, ocupada, reservada }
enum EstadoComanda { abierta, en_cocina, lista, cerrada, cancelada }
enum EstadoItem    { pendiente, en_preparacion, listo, entregado, cancelado }
```

**Endpoints del módulo:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/restaurant/tables` | Mapa de mesas con estado en tiempo real |
| POST | `/restaurant/orders` | Crear comanda para una mesa |
| PATCH | `/restaurant/orders/:id/items/:itemId` | Cambiar estado de un ítem (ej: `en_preparacion`) |
| POST | `/restaurant/orders/:id/close` | Cerrar comanda y generar venta |

**Pantalla de Mapa de Mesas (Frontend):**
- Vista visual del plano del restaurante con mesas codificadas por color según su estado.
- Al hacer clic en una mesa ocupada → ver la comanda activa.
- Al hacer clic en una mesa libre → abrir nueva comanda.

**Pantalla KDS (Kitchen Display System):**
- Vista separada y fullscreen para la cocina.
- Muestra todas las comandas con estado `en_cocina`.
- El cocinero puede marcar ítems como `listo`.
- Actualización en tiempo real vía WebSocket (NestJS Gateways).

---

### F3 — Servicio `local-helper` (Hardware)

**Qué hacer:** Crear un microservicio Node.js liviano que se instala en la computadora del negocio y actúa como puente entre el navegador web y los dispositivos de hardware locales.

**Estructura:**
```
local-helper/
├── package.json
├── index.js             # Servidor Express + WebSocket
├── adapters/
│   ├── bascula.adapter.js      # Lectura de báscula por serial
│   ├── impresora.adapter.js    # Comandos ESC/POS
│   └── cajon.adapter.js        # Apertura de cajón
└── config.json          # Puerto serial, velocidad, modelo de impresora
```

**Comunicación:**
- El `local-helper` expone un **WebSocket en `ws://localhost:7070`**.
- El frontend se conecta a este WebSocket para recibir lecturas de báscula y enviar comandos de impresión.
- El `local-helper` se instala como proceso que arranca con el sistema operativo.

**Integración con la terminal POS:**
- Al agregar un producto granel al carrito, el frontend se suscribe al evento `peso_actualizado` del WebSocket.
- Al completar una venta, el frontend envía el evento `imprimir_ticket` con el JSON del ticket.
- Si el `local-helper` no está disponible → modo manual (el cajero ingresa el peso manualmente; el ticket se guarda en digital).

---

### F4 — PWA + Soporte Offline Parcial

**Qué hacer:** Convertir el frontend en una Progressive Web App con capacidad de operar la terminal POS de forma limitada sin conexión.

**Estrategia offline:**
- **Service Worker** cachea los assets estáticos del frontend.
- **IndexedDB** almacena los últimos 500 productos consultados.
- **Cola de sincronización** almacena ventas realizadas offline y las sincroniza al recuperar conexión.
- El dashboard y los reportes NO funcionan offline (muestran mensaje de sin conexión).

**Reglas:**
- Las ventas offline usan un UUID local temporal que se reemplaza por el definitivo al sincronizar.
- Si hay un conflicto de stock al sincronizar (el producto se agotó en otra caja), notificar al admin.
- El Service Worker no cachea endpoints de autenticación por seguridad.

---

## Entregables

- [ ] Migración Prisma `add_cfdi_restaurant` aplicada
- [ ] `backend/src/modules/adapters/cfdi/` — 2 adaptadores (FacturAPI, Mock)
- [ ] `backend/src/modules/cfdi/` — módulo de facturación con portal de autofacturación
- [ ] `backend/src/modules/restaurant/` — módulo completo de comandas y mesas
- [ ] `frontend/src/views/RestaurantMapView.tsx` — mapa de mesas
- [ ] `frontend/src/views/KDSView.tsx` — pantalla de cocina fullscreen
- [ ] `local-helper/` — microservicio de hardware (repositorio separado o subdirectorio)
- [ ] `frontend/public/sw.js` — Service Worker para PWA
- [ ] Tests de integración del módulo CFDI con el adaptador Mock

---

## Validaciones

### Pruebas funcionales
1. Timbrar un CFDI para una venta con cliente con RFC válido → verificar UUID del SAT en la respuesta.
2. Cancelar el CFDI dentro de las primeras 72h → estado cambia a `cancelado`.
3. Acceder al portal de autofacturación `GET /cfdi/self-invoice/:token` → ingresar RFC y timbrar.
4. Crear una mesa `Mesa 5` con capacidad 4.
5. Abrir comanda para `Mesa 5`, agregar 2 platillos.
6. Desde la pantalla KDS, marcar los platillos como `listo`.
7. Cerrar la comanda → se crea una `Venta` normal con los mismos items.
8. Desconectar la red → realizar una venta en la terminal POS → venta se guarda offline.
9. Reconectar la red → la venta se sincroniza automáticamente con el backend.

### Pruebas de integridad fiscal
1. Intentar timbrar sin RFC de receptor → error con mensaje claro.
2. Intentar cancelar un CFDI de más de 72h → sistema rechaza y sugiere Nota de Crédito.

---

## Criterios de Salida

- [ ] El flujo completo de timbrado CFDI funciona con el adaptador real (no mock) en ambiente de pruebas del SAT.
- [ ] El mapa de mesas se actualiza en tiempo real cuando otro mesero cambia el estado de una mesa.
- [ ] La pantalla KDS recibe actualizaciones de nuevas comandas vía WebSocket sin refresco manual.
- [ ] El `local-helper` imprime un ticket correctamente en una impresora térmica real.
- [ ] Una venta realizada offline se sincroniza correctamente al recuperar conexión.
- [ ] El adaptador del PAC puede cambiarse por variable de entorno sin cambios de código.

---

## Dependencias para la Siguiente Fase

Esta es la última fase del roadmap documentado. Las siguientes iteraciones posibles son:

| Mejora futura | Descripción |
|--------------|-------------|
| App móvil nativa (Expo) | Versión nativa para iOS/Android de la terminal de caja |
| E-commerce integrado | Catálogo web sincronizado con el inventario CUDII |
| Soporte offline completo | Sincronización bidireccional sin pérdida de datos |
| Módulo de contabilidad | Integración con sistemas contables (CONTPAQi, Aspel COI) |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El PAC (proveedor de timbrado) tiene downtime y no se puede facturar | Implementar cola de reintentos con Bull; el CFDI queda en estado `pendiente_timbrado` |
| El XML del CFDI no pasa la validación del SAT por datos incorrectos | Validar todos los campos requeridos antes de enviar al PAC; mostrar errores específicos al usuario |
| El WebSocket del `local-helper` no es accesible desde el navegador (CORS/SSL) | Usar `ws://localhost` sin SSL en LAN interna; documentar la configuración de red requerida |
| Las ventas offline tienen conflicto de stock al sincronizar | Implementar resolución de conflictos: notificar al admin y marcar la venta como "requiere revisión" |
| El módulo de restaurantes comparte demasiada lógica con el POS y crea acoplamiento | Mantener `restaurant` como módulo independiente que solo llama a `sales.service.ts` al cerrar una comanda |
