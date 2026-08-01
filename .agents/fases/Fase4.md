# Fase 4 — Clientes, Crédito, Reportes y Dashboard

> **Estado:** 🔴 PENDIENTE  
> **Versión objetivo:** V1.5  
> **Dependencia de:** Fase 3 (completada)  
> **Produce para:** Fase 5

---

## Objetivo

Añadir las capas de fidelización, crédito y visibilidad operacional al sistema. Esta fase convierte CUDII de un simple registrador de ventas en una herramienta de gestión integral del negocio:

- El cajero puede asociar ventas a un cliente registrado.
- El gerente ve en su dashboard las métricas del día.
- El dueño puede consultar márgenes, reportes de inventario y gestionar fiados.

---

## Alcance

**Incluido:**
- Modelos `Cliente`, `ProgramaLealtad`, `CuentaCreditoCliente`, `VentaCredito`, `AbonoCredito`
- CRUD de Clientes con datos fiscales opcionales
- Programa de puntos y niveles (tiers)
- Módulo de Crédito/Fiados: apertura de cuenta, ventas a crédito, registro de abonos
- Dashboard del negocio con métricas en tiempo real
- Reportes básicos exportables: ventas del día, inventario, top productos, cortes de caja
- Gestión de Estado de Cuenta del cliente (pantalla + PDF)

**No incluido:**
- IA conversacional (Fase 5)
- Órdenes de compra (Fase 5)
- Facturas CFDI (Fase 6)
- Notificaciones automáticas multicanal (Fase 5)

---

## Prerequisitos

- Fase 3 completada y validada
- El modelo `Venta` tiene el campo `clienteId` como nullable (preparado desde Fase 3)
- El sistema de `MovimientoInventario` y `SesionCaja` está generando datos reales

---

## Entradas

| Artefacto de Fase 3 | Uso en Fase 4 |
|--------------------|--------------|
| Modelo `Venta` con `clienteId` nullable | Se vincula con el nuevo modelo `Cliente` |
| `GET /sales` con filtros | Base para los endpoints de reportes |
| `SesionCaja` con totales por método de pago | Dashboard muestra resumen del día en tiempo real |
| `MovimientoInventario` con todos los tipos | Reporte de movimientos de inventario |
| `DetalleVenta` con `precioUnitario` | Cálculo de margen de ganancia en reportes |

---

## Actividades

### D1 — Extender Schema Prisma: Clientes y Crédito

**Modelos a agregar:**

```prisma
model Cliente {
  id                String   @id @default(uuid())
  empresaId         String
  nombre            String
  apellidoPaterno   String?
  email             String?
  telefono          String?
  rfc               String?
  puntosActuales    Int      @default(0)
  puntosHistoricos  Int      @default(0)
  tier              TierLealtad @default(sin_tier)
  estaActivo        Boolean  @default(true)
  creadoEn          DateTime @default(now())
  actualizadoEn     DateTime @updatedAt
  ventas            Venta[]
  cuentaCredito     CuentaCreditoCliente?
}

enum TierLealtad { sin_tier, bronce, plata, oro, platino }

model CuentaCreditoCliente {
  id                    String   @id @default(uuid())
  clienteId             String   @unique
  cliente               Cliente  @relation(fields: [clienteId], references: [id])
  limiteCredito         Float
  saldoPendiente        Float    @default(0)
  diasMaximoVencimiento Int      @default(30)
  estaActivo            Boolean  @default(true)
  creadoEn              DateTime @default(now())
  ventasCredito         VentaCredito[]
}

model VentaCredito {
  id             String   @id @default(uuid())
  ventaId        String   @unique
  clienteId      String
  montoTotal     Float
  montoPagado    Float    @default(0)
  saldoPendiente Float
  estado         EstadoCredito @default(pendiente)
  fechaVencimiento DateTime
  abonos         AbonoCredito[]
}

enum EstadoCredito { pendiente, parcialmente_pagada, liquidada, vencida }
```

**Ejecutar:** `npx prisma migrate dev --name add_clientes_credito_lealtad`

---

### D2 — Módulo `customers` (Backend)

**Endpoints:**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/customers` | Listar clientes con búsqueda | ADMIN, GERENTE, CAJERO |
| GET | `/customers/:id` | Detalle con puntos, historial de compras, saldo crédito | ADMIN, GERENTE |
| POST | `/customers` | Crear cliente | ADMIN, GERENTE, CAJERO |
| PATCH | `/customers/:id` | Editar datos | ADMIN, GERENTE |
| DELETE | `/customers/:id` | Soft delete | ADMIN |
| POST | `/customers/:id/credit-account` | Abrir cuenta de crédito con límite | ADMIN, GERENTE |
| POST | `/customers/:id/payment` | Registrar abono a deuda | CAJERO, GERENTE |
| GET | `/customers/:id/statement` | Generar estado de cuenta | ADMIN, GERENTE |

**Reglas de crédito:**
- Al registrar una `VentaCredito`, validar que `saldoDisponible >= montoVenta`, donde `saldoDisponible = limiteCredito - saldoPendiente`.
- Si el monto excede el límite → error `422 Unprocessable Entity` con mensaje claro.
- Los abonos se aplican en orden FIFO: pagan primero la `VentaCredito` más antigua.
- Al liquidar completamente una `VentaCredito` → actualizar `estado: 'liquidada'` y registrar `fechaLiquidacion`.

---

### D3 — Integración de Cliente en el Flujo de Venta

**Qué hacer:** Modificar `POST /sales` para aceptar `clienteId` opcional y:
- Si se proporciona `clienteId` y la venta es con método `credito`: crear `VentaCredito` en lugar de registrar un `PagoVenta`.
- Acumular puntos al cliente si la venta fue completada (no cancelada ni a crédito no liquidado).

**Cálculo de puntos (configuración default):**
- `puntosGanados = floor(total / 10)` → 1 punto por cada $10 gastados.
- Actualizar `puntosActuales` y `puntosHistoricos` del cliente.
- Recalcular `tier` basado en `puntosHistoricos`:
  - 0 → `sin_tier`, 100 → `bronce`, 500 → `plata`, 1500 → `oro`, 5000 → `platino`.

---

### D4 — Dashboard (Frontend)

**Qué hacer:** Construir el Dashboard del negocio con métricas en tiempo real.

**Tarjetas de métricas (KPIs del día):**
- Ventas del día (total en pesos)
- Número de transacciones
- Ticket promedio
- Total en efectivo vs tarjeta
- Alertas de stock bajo (badges rojos)

**Gráficas:**
- Ventas por hora del día (gráfica de barras)
- Top 5 productos más vendidos hoy (gráfica horizontal)

**Widgets adicionales:**
- Clientes con crédito próximo a vencer (tabla)
- Últimas ventas (feed en tiempo real)
- Estado de las cajas abiertas

**Cómo:** Usar `recharts` o `chart.js` para las gráficas. Los datos se obtienen de endpoints de reportes con polling cada 30 segundos o usando Server-Sent Events.

---

### D5 — Módulo `reports` (Backend y Frontend)

**Endpoints de reportes:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reports/sales-summary` | Resumen de ventas (por día/semana/mes) |
| GET | `/reports/top-products` | Top N productos más vendidos |
| GET | `/reports/inventory` | Estado de inventario con alertas |
| GET | `/reports/cash-register` | Histórico de cortes X/Z con diferencias |
| GET | `/reports/margin` | Margen de ganancia por producto/categoría |

**Todos los reportes:**
- Aceptan parámetros: `fechaInicio`, `fechaFin`, `sucursalId` (si el admin tiene múltiples).
- Respetan RBAC: un `CAJERO` solo ve datos de su turno; un `GERENTE` ve su sucursal; un `ADMIN` ve todo.
- Tienen endpoint adicional `?format=csv` que devuelve el reporte en CSV descargable.

---

## Entregables

- [ ] Migración `add_clientes_credito_lealtad` aplicada
- [ ] `backend/src/modules/customers/` — módulo completo
- [ ] `backend/src/modules/reports/` — endpoints de los 5 reportes principales
- [ ] `frontend/src/views/DashboardView.tsx` — dashboard con KPIs y gráficas reales
- [ ] `frontend/src/views/ClientesView.tsx` — CRUD de clientes
- [ ] `frontend/src/views/FiadosView.tsx` — gestión de crédito y abonos
- [ ] Integración de `clienteId` en la terminal POS (campo de búsqueda de cliente)
- [ ] Acumulación de puntos al finalizar la venta

---

## Validaciones

### Pruebas funcionales
1. Crear cliente `Juan Pérez` con teléfono y email.
2. Abrir cuenta de crédito con límite $2,000.
3. Realizar una venta a crédito de $500 → verificar `VentaCredito` creada, `saldoPendiente: 500`.
4. Intentar venta a crédito de $2,000 con saldo pendiente de $500 (superaría el límite) → sistema rechaza.
5. Registrar abono de $300 → `saldoPendiente` queda en $200; estado `parcialmente_pagada`.
6. El Dashboard muestra las ventas del día correctamente.
7. `GET /reports/sales-summary?fechaInicio=hoy` → devuelve el resumen correcto.
8. `GET /reports/inventory` → muestra los productos con stock bajo correctamente.

---

## Criterios de Salida

- [ ] El CRUD de clientes funciona desde el frontend.
- [ ] Las ventas a crédito crean la deuda y descuentan el límite disponible.
- [ ] Los abonos reducen el saldo correctamente en orden FIFO.
- [ ] La acumulación de puntos funciona al completar ventas.
- [ ] El Dashboard muestra métricas reales (no datos hardcodeados).
- [ ] Los 5 reportes principales están disponibles y el formato CSV funciona.

---

## Dependencias para la Fase 5

| Artefacto producido | Cómo lo usa Fase 5 |
|--------------------|-------------------|
| Módulo `reports` con endpoints de datos de negocio | La IA conversacional de Fase 5 consulta estos mismos endpoints para responder preguntas |
| Modelo `Cliente` y `VentaCredito` | El módulo de notificaciones de Fase 5 envía alertas cuando se acerca el vencimiento de una deuda |
| `InventarioSucursal` con `stockActual` y `stockMinimo` | El módulo de compras de Fase 5 detecta automáticamente los productos que necesitan reabastecimiento |
| Estructura de DTOs y endpoints documentada | La migración asistida de Fase 5 importa clientes y productos usando los mismos módulos |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El cálculo del tier de lealtad se vuelve inconsistente si hay abonos y cancelaciones | Recalcular el tier en un job asíncrono semanal en lugar de en cada transacción |
| Las ventas a crédito quedan sin pagar y el límite se satura | Agregar alerta automática cuando el cliente supera el 80% de su límite |
| Los reportes son lentos con mucho volumen de datos | Agregar índices en `Venta.creadoEn`, `Venta.sucursalId`, `DetalleVenta.productoId` |
| El dashboard se recarga con polling y consume mucha batería en tablets táctiles | Usar SSE (Server-Sent Events) para actualizaciones en lugar de polling agresivo |
