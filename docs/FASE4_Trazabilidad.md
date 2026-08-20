# Fase 4: Trazabilidad Universal y Caducidad Condicional

## Resumen

Refactorización del modelo de trazabilidad de productos para garantizar que **todos** los productos con inventario tengan seguimiento por lote, separando la caducidad como un atributo condicional.

## Problema anterior

El campo `requiereLote` (default `false`) controlaba dos cosas a la vez:
1. **Trazabilidad por lote** (¿de dónde vino este producto?)
2. **Caducidad** (¿este producto expira?)

Si el usuario no activaba `requiereLote`, el producto se vendía sin trazabilidad — sin saber de qué lote salió, a qué costo entró, ni de qué proveedor vino.

## Solución implementada

### Modelo conceptual

| `manejaInventario` | `tieneCaducidad` | Comportamiento |
|---|---|---|
| `true` | `true` | Lotes con caducidad → FEFO prioriza por vencimiento |
| `true` | `false` | Lotes sin caducidad → FEFO funciona como FIFO |
| `false` | `—` | Sin inventario (servicios, digitales) |

### Cambios en el schema

```diff
model Producto {
-  requiereLote     Boolean @default(false)
   manejaInventario Boolean @default(true)  // true => SIEMPRE trazabilidad por lote
+  tieneCaducidad   Boolean @default(false) // true => fechaCaducidad obligatoria en GRN
}
```

### Cambios por capa

#### Backend
- **`lotes.helper.ts`**: Guard cambiado de `requiereLote` → `manejaInventario`
- **`sales.service.ts`**: Eliminado guard redundante, `consumirLotes` se ejecuta siempre dentro del bloque `manejaInventario`
- **`inventory.service.ts`**: Guard cambiado + nueva lógica para crear lotes automáticamente en ajustes positivos
- **`inventory.controller.ts`**: Campos `costoUnitario?` y `fechaCaducidad?` agregados al body de `POST /adjust`
- **`merma.service.ts`**: Guard cambiado de `requiereLote` → `manejaInventario`
- **DTOs**: `requiereLote` eliminado, `tieneCaducidad` agregado

#### Frontend
- **`types/pos.ts`**: `requiereLote` → `tieneCaducidad` en interfaces `Producto` y `RecepcionDetalle`
- **`ProductoModalForm.tsx`**: Toggle "Control por lotes" → "Tiene caducidad" con tooltip informativo
- **`RecepcionMercanciaModal.tsx`**: Validación de caducidad basada en `tieneCaducidad`
- **`InventarioView.tsx`**: UI de entradas con costoUnitario y fechaCaducidad; salidas con selector de lote

### Flujo de datos

```
Producto (manejaInventario=true)
  │
  ├── Recepción de Mercancía (GRN)
  │     ├── Crea Lote con codigoLote, costoUnitario, fechaCaducidad (si tieneCaducidad)
  │     ├── Actualiza InventarioSucursal.stockActual
  │     └── Crea MovimientoInventario (tipo: compra)
  │
  ├── Ajuste manual (entrada)
  │     ├── Crea lote automático con costoUnitario del body
  │     └── Crea MovimientoInventario (tipo: ajuste_positivo)
  │
  ├── Venta POS
  │     ├── consumirLotes() aplica FEFO/FIFO
  │     ├── Crea DetalleVentaLote por cada lote consumido
  │     └── costoHistorico = promedio ponderado de lotes
  │
  ├── Ajuste manual (salida)
  │     ├── consumirLotes() o lote específico
  │     └── Opcionalmente registra Merma
  │
  └── Merma
        ├── consumirLotes() si no se especifica lote
        └── Crea registro de Merma con costo
```

## Por qué esta elección

1. **Separación de concernimientos**: Trazabilidad y caducidad son conceptos distintos. Un producto puede tener trazabilidad sin caducidad (harina, papel higiénico) o trazabilidad con caducidad (pan, leche).

2. **`manejaInventario` ya es el guard correcto**: Si un producto tiene stock, ya necesita trazabilidad. No hay razón para que `requiereLote` sea un campo separado.

3. **Experiencia de usuario**: El toggle "Tiene caducidad" es más intuitivo que "Control por lotes". El usuario entiende inmediatamente qué implica.

4. **Backward compatible**: Los productos existentes con `manejaInventario=true` ahora tienen trazabilidad automáticamente. No se pierde data.

5. **Ajustes manuales con trazabilidad**: Antes, un ajuste manual creaba stock "a ciegas". Ahora crea un lote automáticamente, manteniendo la cadena de trazabilidad completa.
