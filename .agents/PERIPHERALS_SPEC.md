# CUDII - Especificación Técnica de Periféricos y Hardware (PERIPHERALS_SPEC)

Este documento establece la arquitectura de integración, protocolos de comunicación, formato de tickets y tolerancia a fallos para interactuar con hardware físico de mostrador (básculas, impresoras térmicas, cajones de dinero y lectores de códigos de barras) en **CUDII**, coordinando con las reglas de negocio descritas en [REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md).

---

## 1. Arquitectura de Conexión y Microservicio `local-helper`

Para garantizar la operación multiplataforma (Web, Windows, Android, iOS), la comunicación con periféricos se organiza en dos modos:

```text
[ Modo Conectado (Hardware Físico) ]
  Caja CUDII (App Expo / Web)
        │
        ▼ (WebSocket local: ws://localhost:8080)
  Microservicio `local-helper` (Node.js en PC/Dispositivo)
        │
        ├──► Puerto Serial / USB / RS232 ──► Báscula Física
        └──► USB / Red / Bluetooth ────────► Impresora Térmica ──► Cajón RJ11

[ Modo Puente / Manual (Hardware Tradicional Sin Cable) ]
  Caja CUDII (App Expo / Web) ──► Entrada Manual de Peso / Control de Cajón Físico Libre

```

### Modos de Integración

1. **Modo Directo / Local Helper:** La aplicación se conecta por WebSockets a `ws://localhost:8080`. El microservicio `local-helper` en Node.js gestiona las lecturas de puertos COM, USB y comandos de impresión sin bloquear la interfaz.
2. **Modo Puente / Manual (Sin Conexión Física):** Diseñado para comercios con hardware antiguo o análogo. El usuario ingresa el peso manualmente en pantalla o abre el cajón con llave tradicional. CUDII procesa la venta con normalidad sin requerir conexión física ni mostrar errores de hardware.

---

## 2. Integración de Básculas Digitales (RS232 / USB / Serie)

CUDII soporta comunicación bidireccional y continua con las principales marcas utilizadas en el mercado mexicano: **Torrey, Rhino, CAS, Ohaus e Izuka**.

### Métodos de Captura de Peso

* **Lectura Automática en Tiempo Real:** El peso se actualiza en vivo en el carrito de compras conforme se colocan o retiran productos del plato.
* **Lectura Manual por Botón:** El cajero presiona el botón u opción *"Obtener Peso"* (`F2` / Tap) para capturar el valor estable actual.
* **Modo Entrada Manual (Puente):** El cajero escribe el peso medido en una báscula sin cable.

### Parsers Estándar de Tramas de Texto (Regex por Marca)

El microservicio `local-helper` limpia los buffers de entrada de los puertos COM/USB usando los siguientes patrones:

```typescript
// Expresiones regulares de parseo en el Local Helper
export const PARSERS_BASCULA = {
  // Torrey (Ej: "  0.125 kg  " / "  1.250kg  ")
  TORREY: /^\s*([0-9]+\.?[0-9]*)\s*(kg|g|lb)?/i,
  
  // Rhino (Ej: "ST,GS,+001.250kg")
  RHINO: /ST,(?:GS|NT),\+?([0-9]+\.[0-9]{3})(kg|g)/i,
  
  // CAS (Ej: "001.250")
  CAS: /^([0-9]{3}\.[0-9]{3})/,
  
  // Ohaus / Genérica RS232 (Ej: "N   0.500 kg")
  OHAUS: /N?\s*([0-9]+\.?[0-9]*)\s*(kg|g|lb)/i
};

```

---

## 3. Impresoras Térmicas de Tickets y Plantillas Editables

CUDII genera comandos en lenguaje **ESC/POS** directo para impresoras térmicas conectadas por USB, Red (TCP/IP), Bluetooth o Puerto Serie.

### Soporte de Ancho de Papel

* **Formato 58 mm (32 columnas):** Optimizado para terminales inteligentes SmartPOS, impresoras portátiles y móviles.
* **Formato 80 mm (48 columnas):** Formato estándar de mostrador para tiendas de alto tráfico y supermercados.
* *Configuración:* El ancho se selecciona por sucursal o caja (`anchoPapel: '58mm' | '80mm'`).

### Personalización de Estilo de Tickets

El usuario puede estructurar el diseño del ticket desde el módulo de configuración Whitelabel (ver [DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md#1-arquitectura-de-hiper-personalizacion) y [REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md#5-personalizacion-de-tickets)):

* Encabezado con Logotipo en mapa de bits (ESC/POS raster).
* Nombre del negocio, RFC, dirección de sucursal y eslogan.
* Tipografía y densidad de impresión (normal, condensada, negrita).
* Inclusión de QR para Autofacturación CFDI 4.0 (`https://factura.cudii.mx/TOKEN`).
* Pie de ticket con mensajes promocionales o políticas de devolución.

---

## 4. Control del Cajón de Dinero

### Opciones de Conexión

1. **Conexión RJ11 vía Impresora:** El cajón se conecta a la impresora térmica y se dispara mediante la ráfaga ESC/POS (`ESC p 0 25 250`).
2. **Conexión USB Directa:** El cajón se controla como un dispositivo USB de pulso por el `local-helper`.
3. **Cajón Manual / Tradicional:** Sin conexión electrónica; el cajero opera la apertura con llave o botón físico.

### Modos de Disparo

* **Apertura Automática:** Se activa al liquidar un cobro en efectivo o devolución.
* **Apertura Manual Autorizada:** Botón de apertura rápida en interfaz, sujeto a permisos de usuario (RBAC, ver [REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md#10-seguridad-y-rbac-roles-y-permisos)) e inscrita en los logs de auditoría (`cajon_abierto_sin_venta`, ver [REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md#103-auditoria-obligatoria)).

---

## 5. Lectores de Código de Barras

* **Modo Emulación de Teclado (HID):** El lector USB/Bluetooth funciona de forma transparente. CUDII intercepta la ráfaga de caracteres con un *buffer listener* global (tiempo entre teclas < 50ms) enviando el código al carrito sin importar qué campo tenga el foco.
* **Soporte 1D y 2D:** Códigos EAN-13, UPC-A, Code 128 y QR Codes (para cupones de lealtad o identificación de clientes).

---

## 6. Manejo de Errores y Notificaciones de Desconexión

1. **Monitoreo de Salud (Heartbeat):** El cliente CUDII mantiene un ping de salud cada 5 segundos con `ws://localhost:8080`.
2. **Notificación Toast de Desconexión:** Si el cable USB/RS232 de la báscula o impresora se desconecta o se apaga el aparato, CUDII emite un **Toast de Advertencia** editable (`"Báscula desconectada. Reintentando conexión..."`, ver [DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md#4-sistema-estandar-y-editable-de-notificaciones-toast)).
3. **Sin Congelamiento:** La pantalla de cobro nunca se traba. El sistema cambia automáticamente al *Modo Entrada Manual* o permite continuar la venta omitiendo el ticket impreso si el papel se agota.

---

## Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant. |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `FRONTEND_STANDARDS.md`| [/CUDII_POS/.agents/FRONTEND_STANDARDS.md](/CUDII_POS/.agents/FRONTEND_STANDARDS.md)| Estándares de programación frontend (React/Vite). |
| 5 | `TESTING_STANDARDS.md` | [/CUDII_POS/.agents/TESTING_STANDARDS.md](/CUDII_POS/.agents/TESTING_STANDARDS.md) | Estrategia de Pruebas Unitarias y E2E. |
| 6 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 7 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 8 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 9 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 10 | `Fase1.md` | [/CUDII_POS/.agents/fases/Fase1.md](/CUDII_POS/.agents/fases/Fase1.md) | Plan detallado y checklist secuencial de la Fase 1 (MVP). |
| 11 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |

