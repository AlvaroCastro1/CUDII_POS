# Guía de Pruebas — Trazabilidad, Lotes y Caducidad

## Requisitos previos

1. Docker corriendo con todos los servicios (`docker compose up -d`)
2. Seed ejecutado: `docker exec cudii_api npx tsx prisma/seed.ts`
3. Frontend accesible en `http://localhost:5173`
4. Credenciales: `admin@cudii.demo` / `password123`

---

## Suite de Pruebas Automatizadas

El proyecto incluye una suite completa de pruebas API con 39 escenarios que cubren todos los flujos de venta, inventario, lotes, devoluciones y validaciones.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `tests/POS_API_TESTS.postman_collection.json` | Colección Postman v2.1 (38 requests, 13 carpetas) |
| `tests/run_tests.js` | Runner Node.js (ejecuta todo contra la API en vivo) |
| `tests/generate_collection.js` | Regenera la colección Postman |

### Ejecutar con Node.js (recomendado)

```bash
node tests/run_tests.js
```

Requiere que el backend esté corriendo en `http://localhost:3000`. Ejecuta los 39 tests en secuencia y muestra resultados.

### Ejecutar con Postman

1. Importar `tests/POS_API_TESTS.postman_collection.json` en Postman
2. Ejecutar la carpeta "00 — Auth" primero para obtener el token
3. Ejecutar las demás carpetas en orden

### Cobertura de la suite

| # | Carpeta | Tests | Escenarios |
|---|---------|-------|------------|
| 00 | Auth | 1 | Login, captura de token |
| 01 | Venta 1 Producto | 6 | Pieza, granel, servicio, validaciones (decimal, cero, negativo) |
| 02 | Multi-Producto | 3 | 2 productos, granel+pieza, 3 tipos mixtos |
| 03 | Consumo Multi-Lote | 3 | FEFO con PanBimbo, Atún, Jugo |
| 04 | Validación Stock | 2 | Excede stock, auto-creación de lote |
| 05 | Devoluciones | 3 | A stock, a merma, decimal rechazado |
| 06 | Métodos de Pago | 3 | Tarjeta, mixto, monto insuficiente |
| 07 | Sesiones de Caja | 2 | Sesión actual, historial |
| 08 | Inventario y Lotes | 3 | Lotes por producto, sin lotes |
| 09 | Unidades de Medida | 2 | Litro decimal OK, pieza decimal rechazada |
| 10 | Descuentos | 3 | General $10, por item $5, combinado |
| 11 | Caducidad | 2 | Con/sin fechaCaducidad |
| 12 | Casos Borde | 5 | Vacío, token inválido, 404, auto-create |

### Notas sobre comportamiento del sistema

- **Auto-creación de lotes**: `consumirLotes` crea un lote desde `InventarioSucursal` cuando no hay lotes activos. Esto es comportamiento intencional, no un bug.
- **Sin validación server-side de pago**: La API acepta `montoPagado < total` sin error. La validación es responsabilidad del frontend.
- **Descuentos son montos fijos**: `descuentoGeneral` (a nivel venta) y `descuento` (por item) — no hay campo de porcentaje.

---

## Escenario 1: Producto con caducidad

### Crear producto
1. Ir a **Productos** → **Nuevo Producto**
2. Seleccionar unidad: **Pieza**
3. Nombre: "Yogurt Griego 150g", Código de barras: "TEST001"
4. Precio compra: $12, Precio venta: $20
5. En "Control de inventario":
   - **Llevar inventario**: ON (default)
   - **Tiene caducidad**: ON ← **esto es lo nuevo**
6. Guardar

### Recibir mercancía
1. Ir a **Inventario** → **Recepción de Mercancía**
2. Buscar "Yogurt Griego"
3. Cantidad: 24, Costo: $12
4. **Lote**: L-YOG-001
5. **Caducidad**: seleccionar fecha 15 días en el futuro ← **debe ser obligatorio** (asterisco rojo)
6. Agregar segunda línea: Cantidad: 12, Lote: L-YOG-002, Caducidad: 45 días
7. Confirmar

### Verificar lotes
1. Ir a **Lotes y Caducidades**
2. Verificar que aparecen 2 lotes de "Yogurt Griego"
3. El lote con caducidad más cercana debe aparecer primero
4. Badge de caducidad: amarillo si ≤30 días, rojo si ≤7 días

### Vender (FEFO)
1. Ir a **POS**
2. Buscar y agregar "Yogurt Griego" × 5 unidades
3. Completar venta
4. Abrir el voucher → verificar que muestra el código del lote consumido (L-YOG-001 primero)

### Verificar en Lotes
1. Ir a **Lotes y Caducidades**
2. Verificar que L-YOG-001 tiene 19 unidades (24 - 5)
3. L-YOG-002 sigue con 12 unidades

---

## Escenario 2: Producto sin caducidad

### Crear producto
1. **Productos** → **Nuevo Producto**
2. Nombre: "Harina de Trigo 1kg", Código: "TEST002"
3. Unidad: Pieza, Precio compra: $18, Precio venta: $28
4. **Tiene caducidad**: OFF ← **el switch debe estar desactivado**
5. Guardar

### Recibir mercancía
1. **Inventario** → **Recepción de Mercancía**
2. Buscar "Harina de Trigo"
3. Cantidad: 36, Costo: $18, Lote: L-HAR-001
4. **Caducidad**: el campo NO tiene asterisco rojo ← **no es obligatorio**
5. Dejar caducidad vacía y confirmar

### Verificar
1. Ir a **Lotes y Caducidades**
2. El lote L-HAR-001 debe mostrar badge "Sin caducidad"
3. Vender desde POS → el voucher muestra el lote sin fecha

---

## Escenario 3: Ajuste manual con lote automático

### Entrada manual
1. Ir a **Inventario** → buscar "Arroz Morelos"
2. Clic en **"Ajustar stock"** → **Entrada**
3. Cantidad: 10
4. **Verificar que aparece la sección "Trazabilidad del lote"**:
   - Campo "Costo unitario" prellenado con el precio de compra del producto
   - Si tiene caducidad: campo "Fecha de caducidad"
5. Cambiar costo a $25
6. Motivo: "Compra a proveedor"
7. Confirmar

### Verificar
1. Ir a **Lotes y Caducidades**
2. Buscar "Arroz Morelos" → debe aparecer un lote nuevo con:
   - Código auto-generado (formato: L-XXXXXX-XXXX)
   - Costo unitario: $25
   - Cantidad: 10

---

## Escenario 4: Merma desde lote

1. Ir a **Lotes y Caducidades**
2. Buscar un lote activo → clic en **Detalle**
3. En el formulario de merma:
   - Cantidad: 2
   - Motivo: "Dañado"
   - Notas: "Paquete golpeado en almacén"
4. Registrar
5. Verificar:
   - El lote tiene 2 unidades menos
   - Aparece un registro de merma en el historial del lote
   - El stock total del producto disminuyó

---

## Escenario 5: Widget de vencimientos

1. Ir a **Inventario**
2. Verificar que el widget **"Lotes por vencer"** muestra:
   - Tarjeta amarilla: lotes por vencer (≤30 días)
   - Tarjeta roja: lotes vencidos (si existen)
   - Valor monetario de cada grupo
3. Hacer clic en una tarjeta → navega a `/admin/lotes` con filtro aplicado

---

## Escenario 6: Servicio (sin inventario)

1. **Productos** → **Nuevo Producto**
2. Seleccionar unidad: **Servicio**
3. **Verificar** que "Llevar inventario" se apaga automáticamente
4. **Verificar** que "Tiene caducidad" se apaga y deshabilita
5. Guardar
6. Intentar agregar en **Recepción de Mercancía** → el servicio no debe aparecer en la búsqueda

---

## Escenario 7: Tooltip informativo

1. **Productos** → **Nuevo Producto**
2. En el paso 3 (Precios), buscar el switch "Tiene caducidad"
3. Poner el cursor sobre el ícono ℹ️ al lado del label
4. **Verificar** que aparece un tooltip con el texto: "Si se activa, la fecha de caducidad sera obligatoria al recibir mercancía de este producto..."
5. Verificar que el tooltip desaparece al quitar el cursor

---

## Escenario 8: Verificar trazabilidad en venta

1. Ir a **POS**
2. Vender un producto con lote (ej: Yogurt Griego × 3)
3. Completar la venta
4. Ir a **Lotes y Caducidades** → buscar el producto
5. Verificar que el lote tiene menos stock
6. Ir al **Detalle del lote** → verificar que aparece un movimiento de tipo "venta" con la fecha actual

---

## Checklist de verificación

| # | Verificación | Esperado |
|---|---|---|
| 1 | Crear producto sin caducidad | `tieneCaducidad=false`, `manejaInventario=true` |
| 2 | Crear producto con caducidad | `tieneCaducidad=true` |
| 3 | GRN con caducidad obligatoria | Asterisco rojo + validación |
| 4 | GRN sin caducidad | Campo opcional |
| 5 | Ajuste entrada crea lote | Lote auto-generado con costo |
| 6 | Ajuste salida consume lote | FEFO automático |
| 7 | Venta muestra lote en voucher | DetalleVentaLote visible |
| 8 | Merma reduce stock del lote | Movimiento registrado |
| 9 | Widget vencimientos muestra datos | Por vencer + vencidos |
| 10 | Servicio no tiene inventario | manejaInventario=false |
| 11 | Tooltip informativo funciona | Tooltip con explicación |
| 12 | Lotes sin caducidad muestran badge | "Sin caducidad" |
