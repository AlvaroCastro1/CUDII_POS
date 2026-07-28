# Estándares de Programación Frontend (React + Vite)

Este documento establece las reglas y convenciones arquitectónicas para el desarrollo del frontend de CUDII (Web App y POS local). Toda IA y desarrollador debe apegarse estrictamente a estos principios.

---

## 1. Stack Tecnológico y Herramientas

- **Framework Core:** React 19+ (Functional Components).
- **Bundler:** Vite.
- **Estilos:** Tailwind CSS (Uso exclusivo de utilidades; prohibido escribir CSS personalizado a menos que sea estrictamente necesario para animaciones complejas, en cuyo caso va en `index.css`).
- **Estado Global:** Zustand (preferible sobre Redux/Context por rendimiento en la caja).
- **Enrutamiento:** React Router DOM (v6+).

## 2. Arquitectura de Carpetas (Sugerida)

```text
src/
├── assets/         # Imágenes, iconos, fuentes
├── components/     # Componentes reusables (UI genérica)
│   ├── ui/         # Botones, Inputs, Modales (Whitelabel)
│   └── pos/        # Componentes específicos del cajero (Teclado numérico, Ticket)
├── features/       # Módulos por dominio de negocio (Ventas, Inventario, Reportes)
├── hooks/          # Custom hooks genéricos
├── lib/            # Utilidades, formateadores y configuración (Axios/Fetch)
├── store/          # Estado global (Zustand)
├── types/          # Interfaces y tipos TypeScript
└── views/ o pages/ # Vistas enrutables
```

## 3. Reglas de Componentes (React)

- **Tipado Estricto:** Todo componente, prop y estado debe usar TypeScript. Prohibido el uso de `any`.
- **Desestructuración:** Desestructurar props en la firma del componente.
- **Modularidad:** Un componente = Una responsabilidad. Si el archivo pasa de 200 líneas, considerar subdividirlo.
- **Rendimiento:** 
  - Usar `useMemo` y `useCallback` para cálculos pesados o funciones que se pasan como props a componentes hijos memoizados.
  - El componente principal de la Caja (POS) no debe hacer re-render completo al agregar un dígito al teclado numérico.

## 4. Estilos, Whitelabel y Animaciones (TailwindCSS)

- **Personalización Marcas Blancas (Whitelabel):** Usar siempre variables CSS configuradas en `tailwind.config.js` (`bg-primary`, `text-secondary`) en lugar de colores rígidos (ej. evitar `bg-blue-500`). Todo componente visual debe ser altamente personalizable para adaptarse a la identidad de los diferentes Tenants.
- **Modo Oscuro (Dark Mode):** Toda interfaz web y del POS debe estar preparada desde el inicio para soportar *Dark Mode*. Utilizar las clases `dark:` de TailwindCSS en cada componente para garantizar una transición elegante y legible en todas las pantallas.
- **Animaciones y Rendimiento:** Se fomenta el uso de animaciones para mejorar la experiencia de usuario, SIEMPRE Y CUANDO no comprometan el rendimiento. El sitio debe mantener **60fps fluidos**. Se deben usar propiedades eficientes (`transform`, `opacity`) y evitar animar características que fuercen re-calculos de diseño (re-flows).
- **Accesibilidad y Ergonomía:** Áreas táctiles mínimas de `h-12 w-12` (48x48px) para botones críticos del POS.

## 5. Manejo de Estado y Peticiones

- **Estado Local vs Global:** Usar Zustand solo cuando el estado deba compartirse entre vistas sin relación directa (ej. Carrito de compras, Configuración del Tenant). Para formularios locales, usar estado local (`useState`) o React Hook Form.
- **Llamadas a API:** Centralizar en `lib/api.ts` utilizando instancias preconfiguradas con interceptores para inyectar el JWT Token.

## Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant . |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `FRONTEND_STANDARDS.md`| [/CUDII_POS/.agents/FRONTEND_STANDARDS.md](/CUDII_POS/.agents/FRONTEND_STANDARDS.md)| Estándares de programación frontend (React/Vite). |
| 5 | `TESTING_STANDARDS.md` | [/CUDII_POS/.agents/TESTING_STANDARDS.md](/CUDII_POS/.agents/TESTING_STANDARDS.md) | Estrategia de Pruebas Unitarias y E2E. |
| 6 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 7 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 8 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 9 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 10 | `Fase1.md` | [/CUDII_POS/.agents/fases/Fase1.md](/CUDII_POS/.agents/fases/Fase1.md) | Plan detallado y checklist secuencial de la Fase 1 (MVP). |
| 11 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |
