# CUDII - Sistema de Diseño, Arquitectura Whitelabel y Guía de Interfaz (DESIGN_SYSTEM)

Este documento establece las directrices visuales, tokens de diseño dinámicos, adaptabilidad responsive, notificaciones Toast, sistema de iconografía y patrones de experiencia de usuario para el ecosistema **CUDII**. Toda IA debe consumir estas variables y reglas sin hardcodear estilos estáticos ni componentes rígidos, en coordinación con la especificación técnica en [SPEC.md](/CUDII_POS/.agents/SPEC.md).

---

## 1. Arquitectura Whitelabel de Hiper-Personalización

CUDII no posee estilos fijos en el código fuente. Toda la interfaz se renderiza consumiendo el objeto dinámico de tema `TemaWhitelabelContext`. Cada negocio puede personalizar su identidad al 100% desde el Panel de Administración.

### Esquema del Objeto de Configuración Whitelabel (JSON)
```json
{
  "marca": {
    "nombreNegocio": "Abarrotes y Novedades CUDII",
    "eslogan": "Tu tienda de confianza",
    "descripcionCorta": "Punto de venta y comercio local",
    "logoPrincipalUrl": "https://.../logo-light.png",
    "logoModoOscuroUrl": "https://.../logo-dark.png",
    "faviconUrl": "https://.../favicon.ico",
    "redesSociales": {
      "facebook": "",
      "instagram": "",
      "whatsapp": ""
    }
  },
  "colores": {
    "colorPrincipal": "#2563EB",
    "colorSecundario": "#0F172A",
    "colorBoton": "#2563EB",
    "colorBotonTexto": "#FFFFFF",
    "colorEnlace": "#2563EB",
    "colorFondoClaro": "#F8FAFC",
    "colorFondoOscuro": "#0F172A",
    "colorSuperficieClaro": "#FFFFFF",
    "colorSuperficieOscuro": "#1E293B",
    "colorTextoClaro": "#0F172A",
    "colorTextoOscuro": "#F8FAFC"
  },
  "tipografia": {
    "fuenteTitulos": "Dongle",
    "fuenteContenido": "Plus Jakarta Sans"
  },
  "interfaz": {
    "modoPredeterminado": "light",
    "headerFijoScroll": true,
    "animacionesHabilitadas": true,
    "estiloNavegacion": "sidebar",
    "mostrarBarraBusquedaHeader": true
  },
  "iconografia": {
    "setPredeterminado": "lucide",
    "tamanoEstandar": 20,
    "grosorLinea": 2,
    "mapeoIconosPersonalizados": {
      "exito": "CheckCircle2",
      "error": "XCircle",
      "advertencia": "AlertTriangle",
      "informacion": "Info",
      "caja": "ShoppingBag",
      "inventario": "Package"
    }
  },
  "notificacionesToast": {
    "posicion": "top-right",
    "duracionMs": 4000,
    "estiloBorde": "rounded-lg",
    "mostrarIcono": true,
    "permitirCierreManual": true,
    "estilosPorTipo": {
      "exito": {
        "colorFondo": "#F0FDF4",
        "colorTexto": "#15803D",
        "colorBorde": "#BBF7D0",
        "icono": "CheckCircle2"
      },
      "error": {
        "colorFondo": "#FEF2F2",
        "colorTexto": "#B91C1C",
        "colorBorde": "#FECACA",
        "icono": "XCircle"
      },
      "advertencia": {
        "colorFondo": "#FFFBEB",
        "colorTexto": "#B45309",
        "colorBorde": "#FDE68A",
        "icono": "AlertTriangle"
      },
      "informacion": {
        "colorFondo": "#EFF6FF",
        "colorTexto": "#1D4ED8",
        "colorBorde": "#BFDBFE",
        "icono": "Info"
      }
    }
  }
}

```

---

## 2. Paleta de Colores Dinámica y Temas (Claro / Oscuro)

La aplicación soporta **Modo Claro (Light Mode)** y **Modo Oscuro (Dark Mode)** en el 100% de sus vistas (Caja, Dashboard, Autofacturación).

### Tokens de Color Obligatorios

* `theme.colors.primary`: Color de marca para botones principales y destacados.
* `theme.colors.secondary`: Para barras de navegación, encabezados y acentos.
* `theme.colors.background`: Fondo principal de la ventana/pantalla.
* `theme.colors.surface`: Fondo de tarjetas, modales y panelería.
* `theme.colors.textPrimary`: Color principal de lectura.
* `theme.colors.textSecondary`: Color para subtítulos, etiquetas y SKUs.
* `theme.colors.link`: Color para hipervínculos e interacciones web.
* `theme.colors.success`: Estado de cobro exitoso o stock saludable (`#16A34A`).
* `theme.colors.warning`: Stock bajo o alertas de caja (`#D97706`).
* `theme.colors.danger`: Cancelaciones, devoluciones o errores (`#DC2626`).

---

## 3. Tipografía y Jerarquía Visual

CUDII combina una estética moderna y distintiva mediante fuentes cargadas dinámicamente:

* **Tipografía de Títulos y Totales (`fuenteTitulos`):** **Dongle** (Google Font). Aporta personalidad moderna, ligera y expresiva. Usada en encabezados principales, total a cobrar en caja, marcación de cambio y tarjetas destacadas.
* **Tipografía de Lectura Técnica (`fuenteContenido`):** **Plus Jakarta Sans** / **Inter**. Usada en listas de productos, tablas con micro-datos, campos de texto, configuraciones y facturas.

| Escala Visual | Token / Componente | Tipografía | Tamaño Sugerido | Peso (Weight) |
| --- | --- | --- | --- | --- |
| **Display (Total Caja)** | `theme.typography.display` | Dongle | 48px - 64px | ExtraBold (800) |
| **H1 (Título Vista)** | `theme.typography.h1` | Dongle | 36px - 42px | Bold (700) |
| **H2 (Subtítulo)** | `theme.typography.h2` | Dongle | 28px - 32px | Bold (700) |
| **H3 (Sección)** | `theme.typography.h3` | Plus Jakarta Sans | 18px - 20px | SemiBold (600) |
| **Body (Texto General)** | `theme.typography.body` | Plus Jakarta Sans | 14px - 16px | Regular (400) |
| **Caption (SKU/Notas)** | `theme.typography.caption` | Plus Jakarta Sans | 12px - 13px | Medium (500) |

---

## 4. Sistema Estándar y Editable de Notificaciones Toast

Toda alerta, confirmación o mensaje de sistema dentro de CUDII debe emitirse mediante notificaciones **Toast unificadas**, las cuales mantienen una estructura homogénea y un alto grado de personalización.

### Estructura Homogénea de una Toast

Toda Toast emitida por el sistema se compone estrictamente de 4 elementos visuales:

1. **Icono Dinámico:** Identificador visual a la izquierda acorde al tipo de mensaje (configurable/remplazable).
2. **Cuerpo de Mensaje:** Título en seminegrita y descripción corta secundaria.
3. **Botón de Cierre Opcional:** Botón discreto para descartar la notificación manualmente.
4. **Barra de Progreso Temporizada:** Indicador visual de tiempo restante antes de desaparecer automáticamente.

### Tipos de Toast Predeterminadas

* **Éxito (`exito`):** Venta completada, producto guardado, sincronización lograda.
* **Error (`error`):** Transacción rechazada, fallo de conexión a periférico, error fiscal SAT.
* **Advertencia (`advertencia`):** Stock crítico, caja abierta sin cobro, desconexión de Wi-Fi.
* **Información (`informacion`):** Actualización lista, nota de turno, aviso de sistema.

### Reglas de Personalización Whitelabel para Toast

El cliente o administrador puede editar globalmente:

* Posición en pantalla (`top-right`, `top-center`, `bottom-right`, `bottom-center`).
* Duración de visibilidad en milisegundos.
* Modificar colores de fondo, texto, bordes e icono para cada uno de los 4 tipos de Toast.
* Remplazar el icono por defecto o subir un archivo vectorial/SVG propio.

---

## 5. Sistema de Iconografía Modular y Personalizable

CUDII utiliza un sistema de iconos vectoriales abstraído mediante el componente unificado `<CudiiIcon name="..." />`.

### Reglas para la IA sobre Iconografía

* **Aislamiento de librería:** Prohibido importar librerías de iconos directamente en las pantallas de cobro (ej. no hacer `import { Check } from 'lucide-react'` directamente en los módulos de venta). Siempre consumir el componente unificado `<CudiiIcon />`.
* **Mapeo Dinámico:** Los nombres semánticos de iconos (ej. `exito`, `error`, `caja`, `impresora`, `bascula`) se traducen mediante la configuración `iconografia.mapeoIconosPersonalizados`.
* **Sustitución Total (Editable):** El cliente puede cambiar la librería o subir SVGs personalizados desde el panel Whitelabel. Si el negocio define un icono custom para "Caja", toda la plataforma actualizará la representación visual de dicho elemento instantáneamente.

---

## 6. Diseño Adaptable (Responsive Design)

La interfaz de CUDII debe adaptarse automáticamente a cualquier factor de forma:

1. **Dispositivos Móviles (Smartphones Android / iOS):**
* Disposición vertical (*Portrait*).
* Menú de navegación inferior o colapsable (*Bottom Navigation* / *Drawer*).
* Teclado numérico adaptable a pantalla completa.


2. **Tablets & Terminales SmartPOS (Android / iPad):**
* Vista optimizada para uso en mostrador o mesero en movimiento.
* Carrito flotante o lateral deslizable.


3. **Escritorio & All-in-One (Windows / Linux / macOS / Web):**
* Disposición horizontal en múltiples columnas (*Grid 12-columnas*).
* Panel lateral fijo de caja a la derecha y catálogo de marcación rápida a la izquierda.
* Compatibilidad total con entrada por mouse, teclado físico, touch y barra de búsqueda en Header Fijo.



---

## 7. Sistema Nativo de Product Tours (Onboarding e Guías Interactivas)

Toda la plataforma CUDII incorpora un motor nativo para **Product Tours (Guías Interactivas)** que acompaña al usuario paso a paso.

### Reglas de Implementación para la IA

* Todo módulo o pantalla principal de CUDII (Caja de Cobro, Inventario, Apertura de Caja, Facturación, Ajustes Whitelabel) debe registrar identificadores unificados (`data-tour="paso-nombre"`).
* **Flujo interactivo:** Cuando un usuario entra por primera vez a un módulo o presiona el botón de ayuda (`?`), el sistema lanza un recorrido guiado con tooltip resaltado, explicando qué hace cada botón.
* **Persistencia:** Estado de tours completados almacenado localmente para no saturar al usuario recurrente.

---

## 8. Animaciones y Micro-interacciones

* **Transiciones fluidas:** Entrada de modales, alertas Toast y cambio de pantalla con animaciones suaves (usando *Reanimated* en Expo / *Framer Motion* en Web).
* **Respeto a Preferencias:** Si `interfaz.animacionesHabilitadas` es `false` o el dispositivo activa "reducir movimiento", todas las animaciones se desactivan instantáneamente para ahorrar batería y recursos.

---

## 9. Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant. |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel (este archivo). |
| 5 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 6 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 7 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 8 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |

