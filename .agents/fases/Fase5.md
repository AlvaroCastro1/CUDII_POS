# Fase 5 — Módulos Avanzados (V2.0)

> **Estado:** 🔴 PENDIENTE  
> **Versión objetivo:** V2.0  
> **Dependencia de:** Fase 4 (completada)  
> **Produce para:** Fase 6

---

## Objetivo

Añadir inteligencia operacional y automatización al sistema. Esta fase transforma CUDII en una herramienta proactiva que ayuda al dueño a tomar mejores decisiones: la IA responde preguntas del negocio, el sistema detecta cuándo falta mercancía y notifica por WhatsApp o Telegram, y los clientes de otros POS pueden migrar sus datos fácilmente.

---

## Alcance

**Incluido:**
- IA Conversacional en el Dashboard (adaptador LLM con patrón Strategy)
- Módulo de Órdenes de Compra y gestión de Proveedores
- Módulo de Migración Asistida (importación de productos/clientes desde CSV/Excel)
- Sistema de Notificaciones multicanal (Telegram, Email)
- Dashboard Temporal Visual (evolución histórica de precios, stock y ventas)

**No incluido:**
- Integración real de CFDI 4.0 (Fase 6)
- Módulo de restaurantes (Fase 6)
- Integración de hardware periférico (Fase 6)
- Soporte offline (Fase 6)

---

## Prerequisitos

- Fase 4 completada y validada
- Los datos de ventas e inventario han sido generados por el ciclo de Fase 3 y 4
- `InventarioSucursal` tiene campos `stockMinimo` configurados en al menos algunos productos

---

## Entradas

| Artefacto de Fase 4 | Uso en Fase 5 |
|--------------------|--------------|
| Módulo `reports` con endpoints de datos del negocio | La IA los consulta como fuente segura de datos para responder preguntas |
| Modelo `Cliente` y `CuentaCreditoCliente` | Las notificaciones de vencimiento de crédito las leen |
| `InventarioSucursal` con `stockActual` y `stockMinimo` | El módulo de compras detecta automáticamente productos a reabastecer |
| Estructura de módulos NestJS + DTOs | La migración reutiliza los módulos `products` y `customers` para insertar los datos importados |

---

## Actividades

### E1 — Módulo de Notificaciones (Backend)

**Qué hacer:** Implementar el sistema de notificaciones multicanal usando el patrón Adapter.

**Interfaz del Adaptador:**
```typescript
// src/modules/adapters/notificaciones/notificacion.adapter.ts
interface NotificacionAdapter {
  enviar(destinatario: string, mensaje: string, asunto?: string): Promise<boolean>;
  esActivo(): boolean;
}
```

**Adaptadores a implementar:**
- `TelegramAdapter` — usa Telegram Bot API (gratuito)
- `EmailAdapter` — usa SendGrid o Nodemailer (con SMTP configurable)
- `MockAdapter` — imprime en consola (para tests y modo demo)

**El adaptador activo** se configura por variable de entorno `NOTIFICACION_CANAL=telegram|email|mock`.

**Eventos que disparan notificaciones:**
- `stock_bajo` — cuando `stockActual <= stockMinimo`
- `credito_proximo_vencer` — cuando `fechaVencimiento <= hoy + 3 días`
- `credito_vencido` — cuando `fechaVencimiento < hoy`
- `venta_cancelada` — aviso al admin de cualquier cancelación
- `alerta_descuento_grande` — descuento manual > 30% en una venta

**Cómo:** Usar un `EventEmitter` de NestJS para disparar eventos desde los servicios de ventas e inventario, y que el módulo de notificaciones los escuche y procese de forma asíncrona.

---

### E2 — Módulo de Proveedores (Backend)

**Modelos a agregar al schema:**
```prisma
model Proveedor {
  id                 String   @id @default(uuid())
  empresaId          String
  nombre             String
  rfc                String?
  contactoNombre     String?
  contactoTelefono   String?
  contactoEmail      String?
  contactoWhatsapp   String?
  diasEntregaPromedio Int?
  estaActivo         Boolean  @default(true)
  creadoEn           DateTime @default(now())
  actualizadoEn      DateTime @updatedAt
  ordenesCompra      OrdenCompra[]
}
```

**Endpoints de proveedores:**
| Método | Ruta | Roles |
|--------|------|-------|
| GET | `/suppliers` | ADMIN, GERENTE |
| POST | `/suppliers` | ADMIN, GERENTE |
| PATCH | `/suppliers/:id` | ADMIN, GERENTE |
| DELETE | `/suppliers/:id` | ADMIN |

---

### E3 — Módulo `orders` (Órdenes de Compra)

**Modelos a agregar:**
```prisma
model OrdenCompra {
  id                   String   @id @default(uuid())
  empresaId            String
  sucursalId           String
  proveedorId          String
  estado               EstadoOrdenCompra @default(borrador)
  subtotal             Float
  total                Float
  observaciones        String?
  origenSugerencia     OrigenOrden @default(manual)
  fechaCreacion        DateTime @default(now())
  fechaEnvio           DateTime?
  fechaEntregaEstimada DateTime?
  fechaRecepcion       DateTime?
  creadoPor            String
  aprobadoPor          String?
  recibidoPor          String?
  productos            OrdenCompraProducto[]
}

enum EstadoOrdenCompra { borrador, enviada, confirmada, parcialmente_recibida, recibida, cancelada }
enum OrigenOrden       { manual, alerta_stock, ia_prediccion }
```

**Endpoints:**
| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/purchase-orders` | Listar órdenes | ADMIN, GERENTE |
| POST | `/purchase-orders` | Crear orden (borrador) | ADMIN, GERENTE |
| POST | `/purchase-orders/:id/send` | Enviar al proveedor | ADMIN, GERENTE |
| POST | `/purchase-orders/:id/receive` | Confirmar recepción y actualizar stock | ADMIN, GERENTE, ALMACEN |

**Al confirmar recepción (`receive`):**
- Por cada producto recibido: INSERT `MovimientoInventario` (tipo: `compra`).
- UPDATE `InventarioSucursal` incrementando `stockActual` con la cantidad recibida.
- Si cantidad recibida < solicitada → estado `parcialmente_recibida`.
- Notificación al admin si hay discrepancia.

---

### E4 — Módulo de Migración Asistida (`imports`)

**Qué hacer:** Implementar el módulo para importar productos y clientes desde archivos CSV/Excel.

**Modelos a agregar:**
```prisma
model TareaImportacion {
  id               String   @id @default(uuid())
  empresaId        String
  tipo             TipoImportacion
  estado           EstadoImportacion @default(subido)
  totalRegistros   Int      @default(0)
  registrosValidos Int      @default(0)
  registrosError   Int      @default(0)
  archivoUrl       String?
  errores          Json?    // Array de ErrorImportacion
  creadoEn         DateTime @default(now())
  completadoEn     DateTime?
  usuarioId        String
}

enum TipoImportacion   { productos, clientes, inventario }
enum EstadoImportacion { subido, analizando, listo, importando, completado, error }
```

**Flujo de importación:**
1. `POST /imports/upload` — sube el archivo, crea `TareaImportacion` con estado `subido`.
2. Un job asíncrono analiza el archivo: detecta columnas, valida datos, genera `registrosError`.
3. `GET /imports/:id` — el frontend polling consulta el estado.
4. `GET /imports/:id/preview` — muestra los primeros 50 registros para revisión.
5. `POST /imports/:id/execute` — ejecuta la importación real de los registros válidos.

**Reglas:**
- Los productos importados se crean usando el mismo servicio de `products.service.ts` (no inserciones directas).
- Si un código de barras ya existe → omitir ese registro y anotarlo en errores.
- Los archivos se conservan 90 días y luego se eliminan automáticamente.

---

### E5 — IA Conversacional (Backend + Frontend)

**Qué hacer:** Integrar un asistente de IA que responde preguntas del negocio en lenguaje natural usando el patrón Strategy.

**Interfaz del Adaptador:**
```typescript
// src/modules/adapters/ia/llm.adapter.ts
interface LLMAdapter {
  completar(prompt: string, contexto: string): Promise<string>;
  esActivo(): boolean;
}
```

**Adaptadores:**
- `OpenAIAdapter` — usa GPT-4o
- `GeminiAdapter` — usa Google Gemini
- `MockAdapter` — respuestas predefinidas para demos sin costo

**El adaptador activo** se selecciona por variable de entorno `IA_PROVEEDOR=openai|gemini|mock`.

**Endpoint:**
```
POST /ai/chat
Body: { pregunta: string }
Response: { respuesta: string, datosVisuales?: object }
```

**Lógica interna:**
1. Recibir la pregunta del usuario.
2. El sistema analiza si la pregunta requiere datos de la BD (ej. "¿cuánto vendí ayer?").
3. Si sí → ejecutar la query SQL correspondiente vía los endpoints de reportes existentes.
4. Construir un prompt con la pregunta + el resultado de los datos.
5. Enviar al LLM adaptador y devolver la respuesta formateada.

**Reglas de seguridad inamovibles:**
- El `empresaId` del usuario autenticado se inyecta en TODAS las queries. Nunca se consultan datos de otro tenant.
- El LLM no puede ejecutar queries directamente → solo lee los resultados de los endpoints existentes.
- Toda acción ejecutable (crear promoción, ajustar precio) requiere confirmación explícita del usuario.

---

## Entregables

- [ ] Migración Prisma `add_proveedores_ordenes_importaciones` aplicada
- [ ] `backend/src/modules/adapters/notificaciones/` — 3 adaptadores (Telegram, Email, Mock)
- [ ] `backend/src/modules/suppliers/` — CRUD de proveedores
- [ ] `backend/src/modules/orders/` — órdenes de compra con recepción atómica
- [ ] `backend/src/modules/imports/` — importación asistida CSV/Excel
- [ ] `backend/src/modules/adapters/ia/` — adaptador LLM con 2 proveedores + Mock
- [ ] `frontend/src/views/ProveedoresView.tsx`
- [ ] `frontend/src/views/OrdenesCompraView.tsx`
- [ ] `frontend/src/views/ImportacionView.tsx` — wizard de importación
- [ ] `frontend/src/components/dashboard/AIChat.tsx` — interfaz de chat con la IA

---

## Validaciones

### Pruebas funcionales
1. Crear un proveedor `Distribuidora del Norte`.
2. Crear una orden de compra de 50 unidades de `Coca-Cola` al proveedor.
3. Confirmar recepción de 45 unidades → estado `parcialmente_recibida`, stock incrementa en 45.
4. Subir un CSV de productos → sistema analiza y reporta errores en los registros con código de barras duplicado.
5. Ejecutar la importación → solo los registros válidos se crean en el catálogo.
6. Preguntar a la IA: "¿Cuáles son mis 3 productos más vendidos esta semana?" → respuesta coherente basada en datos reales.
7. Configurar notificación de `stock_bajo` vía Telegram → bajar el stock de un producto bajo el mínimo → verificar que llega la notificación al bot.

---

## Criterios de Salida

- [ ] Las notificaciones se envían correctamente por el canal configurado.
- [ ] Las órdenes de compra actualizan el inventario atómicamente al recibir mercancía.
- [ ] La importación CSV crea productos sin duplicados y reporta los errores.
- [ ] La IA responde preguntas de negocio con datos reales del tenant autenticado.
- [ ] Cambiar el proveedor de IA (variable de entorno) no requiere cambios de código.
- [ ] El módulo de IA no expone datos de un tenant a otro bajo ninguna circunstancia.

---

## Dependencias para la Fase 6

| Artefacto producido | Cómo lo usa Fase 6 |
|--------------------|-------------------|
| Adaptador LLM (Strategy Pattern) | Fase 6 puede agregar un nuevo proveedor de IA sin modificar el core |
| Módulo de notificaciones multicanal | Fase 6 lo usa para notificar cuando un CFDI es timbrado o cancelado |
| Módulo `imports` con validación de datos | Fase 6 extiende la importación para incluir datos fiscales (RFC, régimen fiscal) |
| Proveedor `Mock` de LLM | Fase 6 usa el mismo mock para los tests E2E del módulo de restaurantes |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El LLM genera SQL peligroso o consulta datos de otro tenant | El sistema nunca pasa SQL al LLM; solo pasa el resultado de queries ya validadas |
| El costo de tokens del LLM se dispara con uso intensivo | Implementar límite de `N` consultas por minuto por empresa (configurable por plan) |
| El archivo de importación es demasiado grande (>50MB) | Limitar a 10MB en el endpoint de upload; procesar en chunks de 1,000 registros |
| Una notificación falla y no se reintenta | Usar una cola de Redis (Bull) para reintentos automáticos con backoff exponencial |
