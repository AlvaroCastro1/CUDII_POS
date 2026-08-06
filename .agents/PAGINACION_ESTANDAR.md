# Estándar de Paginación en CUDII

## Propósito

Este documento establece las reglas, patrones y convenciones obligatorias para implementar paginación en **todas** las listas de datos del sistema CUDII. Su objetivo es garantizar que la interfaz sea rápida y eficiente independientemente del volumen de datos del negocio.

> **Regla de Oro:** Ninguna tabla o lista en CUDII debe cargar más de **50 registros** en una sola petición al backend. Toda vista con datos tabulares DEBE implementar paginación desde su primera versión.

---

## 1. Arquitectura General

La paginación en CUDII sigue el patrón **offset/limit** a nivel de base de datos, exponiendo los parámetros `page` y `limit` en los endpoints GET. El backend devuelve siempre una respuesta envuelta (wrapper) con metadata.

### 1.1 Contrato de Respuesta (Backend)

Todos los endpoints paginados DEBEN retornar la siguiente estructura:

```json
{
  "data": [...],
  "meta": {
    "total": 1240,
    "page": 1,
    "limit": 20,
    "totalPages": 62,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 1.2 Parámetros de Query (Backend)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Página actual (base 1) |
| `limit` | `number` | `20` | Registros por página |
| `search` | `string` | `""` | Término de búsqueda general |
| `orderBy` | `string` | (campo por defecto) | Campo por el que ordenar |
| `order` | `'asc' \| 'desc'` | `'asc'` | Dirección del ordenamiento |

---

## 2. Implementación Backend (NestJS + Prisma)

### 2.1 Helper de Paginación Reutilizable

Crear el archivo `src/common/helpers/paginate.helper.ts`:

```typescript
/**
 * Calcula el offset de Prisma y retorna la metadata de paginación.
 * @param page - Página actual (base 1)
 * @param limit - Registros por página
 * @param total - Total de registros que coinciden con el filtro
 */
export function calcularPaginacion(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  return {
    skip,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
```

### 2.2 Ejemplo en un Servicio

```typescript
// products.service.ts
async findAll(empresaId: string, page = 1, limit = 20, search = '') {
  const where = {
    empresaId,
    estaActivo: true,
    ...(search ? {
      OR: [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigoBarras: { contains: search } },
      ]
    } : {})
  };

  const [total, data] = await Promise.all([
    this.prisma.producto.count({ where }),
    this.prisma.producto.findMany({
      where,
      include: { categorias: true },
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const { meta } = calcularPaginacion(page, limit, total);
  return { data, meta };
}
```

### 2.3 Ejemplo en un Controlador

```typescript
@Get()
findAll(
  @Query('page') page = '1',
  @Query('limit') limit = '20',
  @Query('search') search = '',
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.productsService.findAll(
    user.empresaId,
    parseInt(page, 10),
    parseInt(limit, 10),
    search,
  );
}
```

---

## 3. Implementación Frontend (React)

### 3.1 Hook Reutilizable `usePaginacion`

Crear el archivo `src/hooks/usePaginacion.ts`:

```typescript
import { useState, useCallback } from 'react';

export interface PaginacionMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Hook centralizado para manejar el estado de paginación.
 * Úsalo en cualquier vista que tenga una tabla paginada.
 */
export function usePaginacion(limitInicial = 20) {
  const [page, setPage] = useState(1);
  const [limit] = useState(limitInicial);
  const [meta, setMeta] = useState<PaginacionMeta | null>(null);

  const irAPagina = useCallback((nuevaPagina: number) => {
    setPage(nuevaPagina);
  }, []);

  const reiniciar = useCallback(() => {
    setPage(1);
  }, []);

  return { page, limit, meta, setMeta, irAPagina, reiniciar };
}
```

### 3.2 Componente `<PaginacionControles />`

Crear el archivo `src/components/ui/PaginacionControles.tsx`:

```tsx
import { Button } from '@/components/ui/button';

interface Props {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  onPageChange: (page: number) => void;
}

/**
 * Componente de controles de paginación reutilizable.
 * Muestra: info de registros + botones de navegación.
 */
export function PaginacionControles({ meta, onPageChange }: Props) {
  const inicio = (meta.page - 1) * meta.limit + 1;
  const fin = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t border-outline/10 mt-2">
      <p className="text-sm text-on-surface-variant">
        Mostrando <span className="font-medium text-on-surface">{inicio}–{fin}</span> de{' '}
        <span className="font-medium text-on-surface">{meta.total}</span> registros
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!meta.hasPrevPage}
        >
          <span className="material-symbols-outlined !text-[18px]">chevron_left</span>
        </Button>
        <span className="text-sm font-medium text-on-surface min-w-[80px] text-center">
          Pág. {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!meta.hasNextPage}
        >
          <span className="material-symbols-outlined !text-[18px]">chevron_right</span>
        </Button>
      </div>
    </div>
  );
}
```

### 3.3 Uso en una Vista (patrón estándar)

```tsx
// En cualquier vista de lista (ej. ProductosView.tsx):
const { page, limit, meta, setMeta, irAPagina } = usePaginacion(20);

const fetchProductos = async () => {
  const res = await api.get(`/products?page=${page}&limit=${limit}&search=${search}`);
  setProductos(res.data.data);
  setMeta(res.data.meta);
};

// Dentro del return, debajo de la tabla:
{meta && <PaginacionControles meta={meta} onPageChange={irAPagina} />}
```

---

## 4. Vistas con Paginación Requerida

| Vista | Endpoint | Limit default | Fase |
|-------|----------|---------------|------|
| `ProductosView` | `GET /products` | 20 | 2 ✅ |
| `CategoriasView` | `GET /categories` | 20 | 2 ✅ |
| `InventarioView` | `GET /inventory/stock/:id` | 20 | 2 ✅ |
| `UsuariosView` | `GET /users` | 20 | 2 ✅ |
| Historial de Movimientos | `GET /inventory/movements` | 30 | 3 |
| Historial de Ventas | `GET /sales` | 30 | 3 |
| Clientes | `GET /customers` | 20 | 4 |
| Reportes | `GET /reports/*` | 50 | 4 |

---

## 5. Reglas de Negocio para la Paginación

1. **Limit máximo por petición:** 100 registros. El backend debe rechazar con `400` si `limit > 100`.
2. **Búsqueda reinicia paginación:** Siempre que el usuario escriba en el buscador, se debe reiniciar a `page = 1`.
3. **Carga en efecto secundario:** El `useEffect` que dispara el fetch debe depender de `[page, search]` para que al cambiar cualquiera de los dos se recarguen los datos.
4. **Estado de carga visible:** Mientras se carga la nueva página, mostrar un indicador de loading en la tabla (esqueleto o spinner), nunca vaciar la tabla abruptamente.
5. **Sin paginación infinita (scroll):** CUDII usa paginación por páginas (offset), no scroll infinito, para permitir que el usuario salte a páginas específicas fácilmente.

---

## 6. Checklist de Implementación por Vista

Al crear o actualizar cualquier vista que contenga una tabla, verificar:

- [ ] Backend: El endpoint acepta `?page=&limit=&search=`
- [ ] Backend: La respuesta incluye el objeto `meta` con `total`, `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage`
- [ ] Backend: El `limit` se valida y tiene un máximo de 100
- [ ] Frontend: Se usa el hook `usePaginacion`
- [ ] Frontend: La búsqueda llama a `reiniciar()` antes de fetchear
- [ ] Frontend: Se renderiza `<PaginacionControles />` debajo de la tabla
- [ ] Frontend: El `useEffect` depende de `[page, search]`
