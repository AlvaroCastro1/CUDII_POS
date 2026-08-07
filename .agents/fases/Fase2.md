# Fase 2 — Catálogo y Gestión de Inventario

> **Estado:** ✅ Completada  
> **Versión objetivo:** MVP Pre-Caja  
> **Dependencia de:** Fase 1 (completada)  
> **Produce para:** Fase 3

---

## Objetivo

Construir el panel de administración que permite a un `ADMIN` o `GERENTE` gestionar el catálogo de productos, el inventario y los usuarios del sistema. Sin esta fase, no existe ningún producto disponible para vender ni usuarios que asignar a una caja.

Al finalizar, el sistema tendrá pantallas funcionales de:
- Gestión de Categorías
- Gestión de Productos (con múltiples unidades de medida)
- Consulta y ajuste de Inventario
- Gestión de Usuarios con asignación de roles

---

## Alcance

**Incluido:**
- Modelo `Categoria` en Prisma y su CRUD completo
- Modelo `HistorialPrecioProducto` en Prisma (auditoría inmutable de cambios de precio)
- CRUD completo de Productos: crear, listar, editar, desactivar (soft delete)
- Configuración de múltiples `PrecioPorUnidad` por producto (secciones colapsables con margen en tiempo real)
- **Múltiples categorías por producto**: relación M:N implícita manejada por Prisma. Un producto puede pertenecer a 0 o más categorías simultáneamente. La UI permite seleccionar varias categorías con chips de color.
- Módulo de Inventario: consulta de stock por sucursal, ajustes manuales con motivo
- CRUD completo de Usuarios: crear, listar, editar rol, desactivar (soft delete)
- Panel de administración en el frontend con rutas protegidas por rol
- **Vista de detalle de producto** (`/admin/productos/:id`): muestra KPIs de stock y precio, precios por volumen, stock por sucursal, historial de precios (con usuario que lo modificó) y movimientos de inventario.

**No incluido:**
- Lotes y caducidades (Fase 3+)
- Traspasos entre sucursales (Fase 3+)
- Importación masiva CSV/Excel (Fase 5)
- Proveedores y órdenes de compra (Fase 5)
- `factorConversion` en PrecioPorUnidad (no necesario según modelo definitivo — ver decisión abajo)

---

## Decisiones de Diseño — Modelo de Precios y Unidades

> **Referencia completa:** [MODELO_PRECIOS_UNIDADES.md](/CUDII_POS/.agents/MODELO_PRECIOS_UNIDADES.md)

### Regla de Oro implementada en esta Fase

Cada producto tiene **una única unidad de inventario** (PIEZA, KILOGRAMO, LITRO, METRO o SERVICIO). Los `PrecioPorUnidad` son **presentaciones de venta** de esa misma unidad — nunca unidades distintas. El stock siempre se decrementa en la unidad base.

### La regla de los dos productos

Si un negocio necesita vender el mismo artículo físico de dos formas de naturaleza diferente (ej: bolsas de plástico que se compran *por kilo* y se venden también *por pieza*), se registran **dos productos separados** en el catálogo. Esta decisión es la práctica estándar de toda la industria POS (SAP, Aspel, CONTPAQi) y garantiza que el inventario no se descuadre. **Esta regla se comunica activamente al usuario en el formulario de alta de productos.**

### ¿Por qué no existe `factorConversion`?

Al adoptar la regla de un producto por unidad, `factorConversion` se vuelve innecesario. No hay que convertir entre unidades porque siempre son la misma. Las presentaciones `PrecioPorUnidad` solo necesitan `cantidadMinima` (cuántas unidades base incluye la presentación) y `precio`.



---

## Prerequisitos

- Fase 1 completada y validada (todos sus criterios de salida cumplidos)
- `docker-compose up -d` funcional
- Schema Prisma con entidades base aplicadas
- Módulo `auth` con `RolesGuard` funcional

---

## Entradas

Artefactos producidos por la Fase 1 que esta fase consume directamente:

| Artefacto | Uso en esta fase |
|-----------|-----------------|
| `schema.prisma` con `Empresa`, `Sucursal`, `Usuario`, `Producto`, `PrecioPorUnidad`, `InventarioSucursal`, `MovimientoInventario` | Se extiende con `Categoria` e `HistorialPrecioProducto` |
| Módulo `auth` + `RolesGuard` + `@Roles()` | Protege todos los endpoints con `@Roles(Rol.ADMIN, Rol.GERENTE)` |
| Layout Dashboard con Sidebar | Se agregan las rutas `/admin/productos`, `/admin/inventario`, `/admin/usuarios` al menú |
| Convenciones de módulos NestJS documentadas en `BACKEND_STANDARDS.md` | Se replican en los nuevos módulos |

---

## Actividades

### B1 — Extender el Schema Prisma

**Qué hacer:** Agregar los modelos `Categoria` e `HistorialPrecioProducto` al `schema.prisma` y vincular `Categoria` con `Producto`.

**Modelos a agregar:**

```prisma
model Categoria {
  id            String     @id @default(uuid())
  empresaId     String
  empresa       Empresa    @relation(fields: [empresaId], references: [id])
  nombre        String
  descripcion   String?
  colorHex      String?    // Para UI: color identificador de la categoría
  icono         String?    // Nombre de icono Material Symbols
  estaActivo    Boolean    @default(true)
  creadoEn      DateTime   @default(now())
  actualizadoEn DateTime   @updatedAt
  productos     Producto[]
}

model HistorialPrecioProducto {
  id              String   @id @default(uuid())
  productoId      String
  producto        Producto @relation(fields: [productoId], references: [id])
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  precioAnterior  Float
  precioNuevo     Float
  tipoPrecio      String   // 'precioVentaBase' | 'precioCompra'
  motivo          String   // Obligatorio
  fechaHora       DateTime @default(now())
}
```

**Cómo:** Agregar el campo `categoriaId String?` y la relación a `Producto`. Ejecutar `npx prisma migrate dev --name add_categoria_historial_precio`.

**Buenas prácticas:** El campo `categoriaId` es opcional (`?`) para no romper productos ya existentes del Onboarding.

**Resultado esperado:** Migración aplicada sin errores. `Categoria` y `HistorialPrecioProducto` visibles en Prisma Studio.

---

### B2 — Módulo `categories` (Backend)

**Qué hacer:** Crear el módulo NestJS para gestión de categorías.

**Estructura:**
```
src/modules/categories/
├── categories.module.ts
├── categories.controller.ts
├── categories.service.ts
└── dto/
    ├── crear-categoria.dto.ts
    └── actualizar-categoria.dto.ts
```

**Endpoints:**
| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/categories` | Listar categorías activas (paginado) | ADMIN, GERENTE, CAJERO |
| POST | `/categories` | Crear categoría | ADMIN, GERENTE |
| PATCH | `/categories/:id` | Editar categoría | ADMIN, GERENTE |
| DELETE | `/categories/:id` | Desactivar (soft delete) | ADMIN |

**Reglas:**
- No se puede desactivar una categoría que tiene productos activos asociados → devolver `409 Conflict`.
- El `empresaId` se extrae del JWT, nunca del body de la petición.

**Resultado esperado:** Todos los endpoints responden correctamente. Prueba con cURL o Postman.

---

### B3 — Módulo `products` (Backend)

**Qué hacer:** Crear el módulo completo de gestión de productos con soporte para múltiples unidades de medida.

**Estructura:**
```
src/modules/products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
└── dto/
    ├── crear-producto.dto.ts
    ├── actualizar-producto.dto.ts
    └── crear-precio-unidad.dto.ts
```

**Endpoints:**
| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/products` | Listar productos (paginado, con filtro por categoría, nombre, código) | ADMIN, GERENTE, CAJERO, ALMACEN |
| GET | `/products/:id` | Detalle de producto con precios y stock | Todos los roles |
| POST | `/products` | Crear producto con sus `PrecioPorUnidad` | ADMIN, GERENTE |
| PATCH | `/products/:id` | Editar datos del producto | ADMIN, GERENTE |
| PATCH | `/products/:id/precios` | Actualizar precios (registra en `HistorialPrecioProducto`) | ADMIN, GERENTE |
| DELETE | `/products/:id` | Soft delete (marca `estaActivo: false`) | ADMIN |

**Reglas de negocio críticas:**
- El cambio de `precioVentaBase` o `precioCompra` SIEMPRE inserta un registro en `HistorialPrecioProducto` con el motivo obligatorio.
- Nunca usar `DELETE` físico: solo `UPDATE estaActivo = false` con auditoria de quién lo hizo y cuándo.
- El campo `codigoBarras` no es unique global, pero sí es único por `empresaId` (un mismo código EAN puede existir en dos empresas distintas).

**Resultado esperado:** CRUD completo funcional. Al editar el precio, se genera un registro en `HistorialPrecioProducto`.

---

### B4 — Módulo `inventory` (Backend)

**Qué hacer:** Crear el módulo de consulta y ajuste de inventario por sucursal.

**Endpoints:**
| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/inventory` | Stock actual de todos los productos en la sucursal activa | ADMIN, GERENTE, ALMACEN |
| GET | `/inventory/alerts` | Productos con stock por debajo de `stockMinimo` | ADMIN, GERENTE |
| POST | `/inventory/adjust` | Ajuste positivo o negativo con motivo | ADMIN, GERENTE, ALMACEN |
| GET | `/inventory/movements` | Historial de movimientos con filtros | ADMIN, GERENTE |

**Regla crítica en `adjust`:**
```typescript
// Dentro de prisma.$transaction:
1. Obtener stockActual actual del InventarioSucursal
2. Calcular stockNuevo = stockActual + (tipo === 'ajuste_positivo' ? cantidad : -cantidad)
3. Validar que stockNuevo >= 0 (no puede quedar negativo)
4. UPDATE InventarioSucursal con stockNuevo
5. INSERT MovimientoInventario con todos los campos
```

**Resultado esperado:** El ajuste de inventario actualiza `InventarioSucursal` y crea el `MovimientoInventario` correspondiente en una sola transacción atómica.

---

### B5 — Módulo `users` (Backend)

**Qué hacer:** Crear el CRUD de usuarios del sistema.

**Endpoints:**
| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/users` | Listar usuarios de la empresa | ADMIN |
| POST | `/users` | Crear usuario con rol | ADMIN |
| PATCH | `/users/:id` | Editar datos o cambiar rol | ADMIN |
| DELETE | `/users/:id` | Soft delete | ADMIN |

**Reglas:**
- Un `ADMIN` no puede eliminar su propia cuenta activa.
- Al crear un usuario, la contraseña se hashea con bcrypt antes de guardar.
- La contraseña nunca se devuelve en ninguna respuesta.
- El cambio de `rol` registra un evento en `HistorialCambioEntidad`.

**Resultado esperado:** El CRUD de usuarios funciona. Un `CAJERO` que intente acceder a `GET /users` recibe 403.

---

### B6 — Panel de Administración (Frontend)

**Qué hacer:** Crear las vistas del panel de administración con rutas protegidas.

**Nuevas vistas:**

| Vista | Ruta | Componentes clave |
|-------|------|------------------|
| `ProductosView` | `/admin/productos` | Tabla paginada, modal de crear/editar, búsqueda |
| `InventarioView` | `/admin/inventario` | Lista con badges de stock, formulario de ajuste |
| `UsuariosView` | `/admin/usuarios` | Tabla de usuarios, modal de creación, selector de rol |

**Cómo:**
- Las rutas `/admin/*` deben estar protegidas: solo accesibles para `ADMIN` y `GERENTE`.
- Si un `CAJERO` intenta navegar a `/admin/productos`, redirigir a la vista de Caja.
- Las tablas deben tener paginación del lado del servidor (no cargar todo en memoria).
- El formulario de producto incluye sección expandible para configurar múltiples `PrecioPorUnidad`.

**Buenas prácticas:**
- Usar componentes de tabla y modal reutilizables.
- Los indicadores de stock bajo (rojo) y agotado (gris) deben ser visualmente distintivos.
- Áreas táctiles mínimas de 48×48px en todos los botones de acción.

**Resultado esperado:** Un `ADMIN` puede crear, editar y desactivar productos, ver el inventario y gestionar usuarios desde el panel web.

---

## Entregables

- [ ] Migración Prisma `add_categoria_historial_precio` aplicada
- [ ] `backend/src/modules/categories/` — módulo completo con CRUD
- [ ] `backend/src/modules/products/` — módulo completo con historial de precios
- [ ] `backend/src/modules/inventory/` — módulo con ajustes y movimientos
- [ ] `backend/src/modules/users/` — módulo completo con CRUD
- [ ] `frontend/src/views/ProductosView.tsx` — gestión de catálogo
- [ ] `frontend/src/views/InventarioView.tsx` — gestión de stock
- [ ] `frontend/src/views/UsuariosView.tsx` — gestión de usuarios
- [ ] Rutas protegidas por rol en el router del frontend

---

## Validaciones

### Pruebas funcionales
1. Crear una categoría `BEBIDAS` → aparece en la lista.
2. Crear un producto `Coca-Cola 600ml` con código de barras, asignado a `BEBIDAS`, con dos precios (`pieza = $18`, `caja 24 = $380`).
3. Editar el `precioVentaBase` → verificar que se creó un registro en `HistorialPrecioProducto`.
4. Desactivar el producto → ya no aparece en la lista activa pero existe en BD.
5. Realizar un ajuste de inventario negativo con motivo `"Merma por caducidad"` → verificar en `MovimientoInventario`.
6. Intentar ajuste negativo mayor al stock actual → el sistema debe rechazarlo.
7. Crear usuario `cajero@tienda.mx` con rol `CAJERO`.
8. Iniciar sesión con el nuevo cajero → solo ve la vista de Caja, no el panel Admin.

### Criterios de calidad
- No hay `any` en TypeScript.
- Todos los DTOs usan `class-validator`.
- No hay `catch` vacíos en los servicios.

---

## Criterios de Salida

La Fase 2 está **terminada** cuando:

- [ ] Las migraciones de Prisma están aplicadas y `migrate status` está limpio.
- [ ] Los módulos `categories`, `products`, `inventory` y `users` tienen endpoints funcionales y documentados.
- [ ] Un Admin puede gestionar el catálogo completo desde el frontend sin errores.
- [ ] El cambio de precio genera historial auditable.
- [ ] Los ajustes de inventario generan `MovimientoInventario` atómicamente.
- [ ] Las rutas del panel admin rechazan acceso a roles no autorizados (retornan 403).

---

## Dependencias para la Fase 3

| Artefacto producido | Cómo lo usa Fase 3 |
|--------------------|-------------------|
| Módulo `products` con endpoint `GET /products` | La terminal POS lo usa para buscar productos por nombre o código de barras |
| Módulo `inventory` con lógica de ajuste atómico | El servicio de ventas reutiliza la misma lógica para descontar stock al registrar una venta |
| Módulo `users` con CRUD funcional | La apertura de sesión de caja requiere un `cajero` (usuario) seleccionable |
| Modelo `InventarioSucursal` con `stockActual` | El sistema valida en tiempo real si hay suficiente stock antes de agregar al carrito |
| Modelo `MovimientoInventario` | La venta inserta movimientos de tipo `venta`; la devolución inserta `devolucion_venta` |
| `HistorialPrecioProducto` | Los reportes de Fase 4 grafican la evolución del precio en el tiempo |

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Condición de carrera en ajuste de inventario (2 peticiones simultáneas) | Usar `SELECT FOR UPDATE` en la transacción de Prisma para bloquear el registro durante la actualización |
| El catálogo puede tener miles de productos y la tabla se vuelve lenta | Implementar paginación server-side desde el inicio; índice en `codigoBarras` y `nombre` |
| Un Admin elimina su propia cuenta accidentalmente | Validar en el servicio que `userId !== req.user.id` antes de hacer soft delete |
| Las rutas del admin son accesibles si el frontend no carga bien el guard | El guard de roles está en el backend (NestJS), no depende del frontend para ser seguro |
