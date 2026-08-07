# CUDII — Modelo Definitivo de Unidades y Precios

> **Regla de Oro:** Un producto tiene **una sola unidad de inventario**.
> Todos sus precios y presentaciones **siempre descuentan stock en esa misma unidad**.
> Jamás se mezclan unidades en el mismo producto.

---

## La regla base: Unidad de Inventario = Unidad de Descuento

Cuando vendes cualquier presentación de un producto, el inventario siempre se decrementa en la **misma unidad base**. El precio varía, la cantidad descuentada varía, pero la **unidad nunca cambia**.

| Unidad Base | ¿Acepta decimales? | Descuento por venta |
|-------------|-------------------|---------------------|
| **PIEZA** | ❌ Solo enteros | Se descuentan N piezas enteras |
| **KILOGRAMO** | ✅ Hasta 3 decimales | Se descuentan N.NNN kg |
| **LITRO** | ✅ Hasta 3 decimales | Se descuentan N.NNN litros |
| **METRO** | ✅ Hasta 3 decimales | Se descuentan N.NNN metros |
| **SERVICIO** | No aplica | No descuenta inventario |

---

## Cómo funcionan los precios escalonados por unidad

Cada unidad tiene sus propias variantes de precio. Todas descuentan en la misma unidad base.

### Familia PIEZA

Stock: se lleva en **piezas enteras**. Descuento mínimo: 1 pieza.

| Presentación | Ejemplo | `cantidadMinima` | `precio` | Stock descontado |
|---|---|---|---|---|
| Unidad (precio base) | 1 Lata de Atún | 1 | $18.50 | 1 pieza |
| Paquete / Six-pack | 6 latas | 6 | $100.00 | 6 piezas |
| Caja cerrada | Caja de 24 | 24 | $380.00 | 24 piezas |
| Mayoreo | 48+ unidades | 48 | $15.50 c/u | N piezas |
| Docena | Cartón de huevo | 12 | $45.00 | 12 piezas |

> **Nota bolsas de plástico en familia PIEZA:** Si el negocio compra sus bolsas ya contadas (1000 piezas), las lleva en PIEZA. Si las compra por kilo y las vende sueltas, las lleva en KILO. La elección es del negocio al registrar el producto.

---

### Familia KILOGRAMO

Stock: se lleva en **kilogramos** con hasta 3 decimales. Descuento mínimo: 0.001 kg.

| Presentación | Ejemplo | `cantidadMinima` | `precio` | Stock descontado |
|---|---|---|---|---|
| Por kilo (precio base) | 1 kg de jamón | 0.001 | $89.00/kg | peso exacto |
| Cuarto de kilo | 250 g de queso | 0.001 | $89.00/kg¹ | 0.250 kg |
| Medio kilo fijo | "Media libra" | 0.500 | $42.00 (precio fijo) | 0.500 kg |
| Arroba / Mayoreo | 11.5 kg+ en carnicería | 11.500 | $75.00/kg | N.NNN kg |
| Costal / Bulto | 50 kg de azúcar | 50.000 | $680.00 | 50.000 kg |

> ¹ Para fracciones del kilo sin precio fijo (granel puro), el precio se calcula: `peso * precioPorKg`. Esto lo maneja la báscula automáticamente.

---

### Familia LITRO

Stock: se lleva en **litros** con hasta 3 decimales.

| Presentación | Ejemplo | `cantidadMinima` | `precio` | Stock descontado |
|---|---|---|---|---|
| Por litro (precio base) | 1 litro de aceite | 0.001 | $35.00/L | litros exactos |
| Medio litro fijo | 0.5 L de refresco | 0.500 | $16.00 | 0.500 L |
| Garrafón | 19 L de agua | 19.000 | $45.00 | 19.000 L |
| Barril / Mayoreo | 200 L+ de lubricante | 200.000 | $25.00/L | N.NNN L |

---

### Familia METRO

Stock: se lleva en **metros** con hasta 3 decimales.

| Presentación | Ejemplo | `cantidadMinima` | `precio` | Stock descontado |
|---|---|---|---|---|
| Por metro (precio base) | 1 m de tela | 0.001 | $120.00/m | metros exactos |
| Medio metro fijo | 50 cm de cinta | 0.500 | $60.00 | 0.500 m |
| Rollo de 10m | Rollo de cable | 10.000 | $1,050.00 | 10.000 m |
| Pieza de 2.5 m | Varilla estándar | 2.500 | $285.00 | 2.500 m |

---

### Familia SERVICIO

Stock: **no aplica** (`manejaInventario = false`). Sin inventario, sin descuento.

| Presentación | Ejemplo | Precio |
|---|---|---|
| Servicio base | Corte de cabello | $150.00 |
| Paquete de servicios | 5 cortes por adelantado | $680.00 |
| Por hora | Consultoría | $800.00/hr |

---

## ¿Qué pasa si un negocio vende bolsas de dos formas?

Ejemplo: una tienda que compra bolsas por kilo al mayoreo pero las vende tanto por kilo como por pieza al cliente.

**Respuesta CUDII: son DOS productos separados en el catálogo.**

| Producto en catálogo | Unidad | Cómo se surte | Cómo se vende |
|---|---|---|---|
| "Bolsas de plástico chica — a granel" | KILO | Se compra por kilo | Se vende por fracción de kilo |
| "Bolsa de plástico chica — unitaria" | PIEZA | Se da de alta manualmente en inventario | Se vende de 1 en 1 |

> Esto **no es una limitación** — es la práctica estándar de todos los POS establecidos (SAP, Aspel, CONTPAQi, etc.). Separar en dos productos permite auditar correctamente cada flujo.

---

## Modelo de datos resultante (sin factorConversion)

Este modelo es completamente suficiente para los 3 tipos de venta descritos:

```
Producto {
  unidadMedida: 'PIEZA' | 'KILOGRAMO' | 'LITRO' | 'METRO' | 'SERVICIO'
  esGranel: boolean  ← true si KILOGRAMO, LITRO o METRO
  precioCompra: Decimal
  precioVentaBase: Decimal  ← precio por 1 unidad base

  preciosPorUnidad[]:
    nombreAlternativo: string   ← "Caja de 24", "Medio kilo", "Mayoreo"
    cantidadMinima: Decimal     ← cuántas unidades base mínimo
    cantidadMaxima?: Decimal    ← null = sin tope
    precio: Decimal             ← precio TOTAL de esa presentación
    esDefault: boolean
}
```

> **No se necesita `factorConversion`** porque la unidad de venta siempre es la misma que la unidad de inventario.

---

## Resumen de las decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| ¿Una unidad base por producto? | ✅ Sí, siempre | Evita descuadre de inventario |
| ¿Precios adicionales mezclan unidades? | ❌ No | Solo variantes en la misma unidad |
| ¿`factorConversion` en la BD? | ❌ No se necesita | La unidad no cambia entre presentaciones |
| ¿Dos formas de venta distintas? | Dos productos en catálogo | Práctica estándar de POS |
| ¿El cajero puede elegir presentación? | ✅ Sí, al agregar al carrito | El POS muestra opciones disponibles |

---

## Formulario de Producto — Diseño final

### Paso 1 (solo al CREAR)
*"¿Cómo llevas el conteo de este producto en tu bodega?"*
Tarjetas: **Pieza · Kilogramo · Litro · Metro · Servicio**
> En modo edición → el paso desaparece, el modal abre en Paso 2.

### Paso 2 — Identificación
Nombre ✱, Código de barras ✱, Código interno, Descripción, Categorías

### Paso 3 — Precios
**Precio base** (obligatorio): precio de compra + precio de venta (por 1 unidad base)
**Presentaciones adicionales** (opcional, colapsables, cada una con su color):
- Nombre de la presentación (ej: "Caja de 24")
- Cantidad mínima (en la unidad base ya definida, ej: "24 piezas")
- Precio total para esa presentación
- Margen calculado en tiempo real vs precio de compra
