# CUDII - Especificación Técnica y Contrato Maestro del Software (SPEC)

Este documento representa la Fuente Única de la Verdad (Single Source of Truth - SSOT) para el sistema POS **CUDII**. Define la arquitectura, modelos de datos, reglas de negocio e integraciones obligatorias. Toda IA debe adherirse estrictamente a estas especificaciones en coordinación con las [Reglas de Negocio](/CUDII_POS/.agents/REGLAS_NEGOCIO.md).

---

## 1. Visión General y Modelo Multitenant

CUDII es una plataforma SaaS de Punto de Venta (POS) y Gestión Comercial multitenant, diseñada para el mercado mexicano y latinoamericano.

### Jerarquía de Datos (Multitenant Architecture)
```text
[ Organización / Empresa / Marca ] (Tenant Raíz)
        │
        ├──► [ Suscripción / Módulos Activos ]
        │
        └──► [ Sucursales ]
                  │
                  └──► [ Cajas / Terminales ]

```

* **Empresa (Tenant):** Entidad legal/comercial con su propio RFC, configuración Whitelabel y catálogo maestro.
* **Sucursal:** Ubicación física o virtual con su propio inventario local, precios específicos y zonas fiscales.
* **Caja / Terminal:** Punto de cobro con identificación física (UUID) que ejecuta el cliente local (Expo) y dialoga con el hardware.

---

## 2. Arquitectura de Suscripción y Módulos

CUDII comercializa sus funciones en niveles (Tier) o módulos independientes activables vía API/Panel:

* **Módulo Core POS:** Caja de cobro, inventario local, clientes, cortes de caja, ventas en efectivo/tarjeta.
* **Módulo Multisucursal & Inventario Avanzado:** Traspasos entre sucursales, lotes, caducidades, proveedores y órdenes de compra.
* **Módulo CFDI 4.0:** Facturación en mostrador + portal web de autofacturación.
* **Módulo Inteligencia Artificial (CUDII-AI):** IA conversacional en dashboard, predicción de stock, recomendador en caja, reportes en lenguaje natural y migración asistida. Ver detalle en el [Plan de Desarrollo](/CUDII_POS/.agents/PLAN_DESARROLLO.md#fase-4-inteligencia-artificial-y-automatizacion).
* **Módulo Restaurantes (V2.0):** Comandas, mapa de mesas y KDS (Kitchen Display System). Ver detalle en el [Plan de Desarrollo](/CUDII_POS/.agents/PLAN_DESARROLLO.md#fase-5-modulo-restaurantes-v20).

---

## 3. Arquitectura SaaS (Cloud-First)

1. **Persistencia Cloud:** Todas las operaciones de caja se escriben directamente en **PostgreSQL** a través del backend NestJS. La capacidad offline queda pospuesta para futuras versiones.
2. **Borrado Lógico (Soft Delete) e Históricos:**
* Queda prohibida la eliminación física (`DELETE`) en base de datos local y remota para entidades core (Productos, Clientes, Usuarios, Promociones, Sucursales).
* Al eliminar una entidad, el sistema realiza una desactivación lógica (`estaActivo: false`), guardando marcas temporales y auditoría de quién realizó la acción. Esto asegura la consistencia relacional e histórica.
* Los cambios en campos críticos (como el precio de venta de productos) se registran en una tabla histórica inmutable, lo que permite al módulo de reportes graficar evoluciones temporales del comportamiento del negocio.

---

## 4. Operación de Caja y Arqueo (Corte X / Z)

* **Modo de Corte Configurable:**
* **Corte Ciego:** El cajero ingresa el monto total contado en efectivo sin ver la expectativa del sistema. El sistema calcula la diferencia internamente y la envía al administrador.
* **Corte Abierto:** El sistema muestra el saldo esperado en pantalla para cuadrar en tiempo real.


* **Histórico y Auditoría:** Cada cierre registra: usuario, hora de apertura/cierre, fondo inicial, ventas por método de pago, retiradas parciales y auditoría de eventos sensibles.

---

## 5. Módulo de Facturación Fiscal (CFDI 4.0 México)

* **Emisión Inmediata (Mostrador):** Selección del cliente por RFC, uso de CFDI, forma de pago y timbrado inmediato mediante proveedor PAC aliado.
* **Portal de Autofacturación:** Cada ticket no facturado en mostrador incluye un código QR y un token alfanumérico único (`https://factura.cudii.mx/TOKEN`). El cliente puede ingresar a la web, escribir su RFC y timbrar de forma autónoma.
* **Venta Global Diaria/Semanal:** Agrupamiento automático de ventas al Público en General (RFC genérico `XAXX010101000`) cumpliendo la normativa SAT vigente.

---

## 6. Adaptadores y Patrones Pluggable

* **Pasarelas de Pago:** Interfaz común para procesar cobros (Mercado Pago, Kushki, NetPay, Clip, Stripe). Cambiar de proveedor requiere solo actualizar la variable de entorno o configuración de la sucursal.
* **Periféricos:** Comunicación vía WebSocket local con el servicio `local-helper` para básculas RS232 y comando térmico ESC/POS. Ver especificación en [PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md).

## 7. Operación desde el Día 0 (Onboarding Inmediato)

CUDII garantiza que cualquier negocio nuevo pueda **realizar su primera venta en menos de 15 minutos** tras registrarse, sin requerir soporte humano ni configuraciones externas.

* **Wizard de Alta Guiada:** Flujo paso a paso asistido que precarga la sucursal, la caja, un catálogo de demostración y el primer usuario.
* **Catálogo Base por Giro de Negocio:** Al registrarse, el sistema pregunta el giro del comercio (abarrotes, ferretería, ropa, salón, etc.) y precarga categorías, unidades de venta y configuraciones relevantes.
* **Modo Demo Automático:** Sin credenciales del SAT ni pasarelas de pago configuradas, el sistema opera con simuladores locales transparentes. Las integraciones reales se activan cuando el cliente las configure.
* **Sin Bloqueo por Conectividad:** La primera apertura de caja funciona 100% offline. El backend puede configurarse después.

---

## 8. IA Conversacional en el Dashboard

El panel de administración integra un asistente de IA conversacional que permite al dueño del negocio consultar datos, crear acciones y recibir análisis en **lenguaje natural en español**.

* **Consultas de negocio:** *"¿Cuál fue mi producto más rentable esta semana?"*, *"¿Cuánto vendí ayer en la sucursal norte?"*
* **Acciones ejecutables:** *"Genera un descuento del 15% en bebidas para este fin de semana"*, *"Avísame si algún cajero aplica descuentos mayores al 30%"*.
* **Análisis comparativo:** *"Compara el rendimiento de mis sucursales este mes"*.
* **Arquitectura:** Las consultas se traducen a queries SQL seguros vía un adaptador de LLM (Strategy Pattern), manteniendo el desacoplamiento del proveedor de IA.

---

## 9. Interfaz Adaptativa Multirol

CUDII presenta una **única aplicación que adapta su interfaz completa** según el rol del usuario autenticado:

| Rol | Vista Adaptada | Funciones Visibles |
| :--- | :--- | :--- |
| **Cajero** | Caja de cobro optimizada | Cobro, búsqueda de productos, ticket |
| **Almacén** | Gestión de inventario | Entradas, lotes, traspasos |
| **Gerente** | Dashboard de sucursal | Reportes del día, alertas, cortes |
| **Admin/Dueño** | Ecosistema completo | Multisucursal, Whitelabel, IA, facturación |
| **Mesero** (V2.0) | Comandas y mesas | Tomar orden, estado de platillos |

* El empleado solo ve lo que necesita. Reduce errores, acelera la capacitación y protege la información confidencial.

---

## 10. Dashboard Temporal Visual (Evolución del Negocio)

CUDII ofrece gráficas de evolución temporal de cualquier dato crítico del negocio, tanto en la app móvil como en reportes exportables:

* **Evolución de precios:** Línea de tiempo del precio de venta/compra de un producto (quién cambió, cuándo y por qué).
* **Evolución de inventario:** Stock de un SKU semana a semana con tendencia.
* **Evolución de lealtad:** Puntos acumulados por cliente mes a mes.
* **Rendimiento de cajeros:** Velocidad de cobro, cancelaciones y descuentos por operador.
* **Comportamiento de ventas:** Comparativa de ventas por hora, día, semana o mes.
* **Formato de visualización:** Disponible en app (gráficas interactivas) y en reportes descargables (PDF/Excel).

---

## 11. Migración Asistida con IA desde Otros Sistemas

Para eliminar la fricción de cambiar de POS, CUDII ofrece herramientas de migración inteligente:

* **Importación masiva de catálogo:** Carga de productos desde Excel/CSV con validación inteligente y sugerencias de corrección automática.
* **Importación de clientes:** Datos fiscales, puntos de lealtad e historial.
* **Mapeo automático de campos con IA:** El sistema detecta el formato del sistema anterior (ASPEL, SAE, Bind, etc.) y mapea los campos automáticamente.
* **Modo de importación supervisada:** Para catálogos con más de 500 productos, el wizard valida los datos y solicita confirmación antes de activar.

---

## 12. Órdenes de Compra a Proveedores

CUDII cierra el ciclo completo de inventario: desde la detección de escasez hasta el reabastecimiento físico con trazabilidad total.

* **Generación de orden:** Al detectar stock bajo (manual o por IA), el sistema genera una orden de compra con membrete del negocio.
* **Envío al proveedor:** Automático por email o WhatsApp con PDF adjunto.
* **Seguimiento:** La compra queda registrada como "pendiente de recibir" en el sistema.
* **Confirmación de recepción:** Al llegar el pedido, un flujo en la app confirma cantidades recibidas y actualiza el stock con el lote correspondiente.

---

## 13. Crédito y Ventas a Cuenta Corriente (Fiados)

CUDII digitaliza el sistema de **fiado** o **crédito informal**, una práctica profundamente arraigada en el comercio local mexicano y latinoamericano que pocos POS gestionan correctamente.

* **Registro de ventas a crédito:** El cajero puede marcar una venta como "a crédito" asociándola a un cliente registrado, sin requerir pago inmediato.
* **Límite de crédito configurable:** Cada cliente tiene un monto máximo de crédito definido por el administrador. El sistema bloquea ventas a crédito que excedan el límite.
* **Seguimiento de saldo pendiente:** Panel de consulta de deudas por cliente con detalle de cada venta fiada, abonos parciales y saldo restante.
* **Abonos y pagos parciales:** El cliente puede realizar abonos a su cuenta en cualquier momento. Cada abono genera un recibo imprimible.
* **Estado de cuenta imprimible/enviable:** Generación de estado de cuenta en PDF con detalle de movimientos, enviable por WhatsApp o imprimible en ticket.
* **Alertas automáticas:** Notificación al admin cuando un cliente supera el 80% de su límite de crédito o tiene deuda vencida por más de X días (configurable).
* **Historial completo:** Todo el historial de fiados, abonos y liquidaciones queda registrado en la tabla de auditoría para trazabilidad.

---

## 14. Devoluciones, Cambios y Garantías

El manejo de devoluciones es un escenario diario en el comercio local. CUDII proporciona una arquitectura de devoluciones que mantiene la integridad tanto del inventario como de la caja registradora.

* **Trazabilidad del Ticket Original:** Las devoluciones se enlazan siempre a una venta previa (mediante escaneo del ticket o búsqueda manual por fecha/monto), previniendo fraudes y devoluciones duplicadas.
* **Separación de Inventario (Stock vs Merma):** El sistema pregunta el estado físico del producto devuelto. Si es "Cambio de talla" o "No le gustó", vuelve al stock disponible. Si es "Caducado" o "Dañado", se envía a un almacén de **Merma** para no ser vendido de nuevo.
* **Integridad de Caja (Cortes Z):** Todo reembolso en efectivo genera automáticamente un "Egreso por Devolución" vinculado al turno actual. Esto garantiza que al cajero no le falte dinero en su cuadre final.
* **Resolución Flexible:** Soporta devolución de dinero (efectivo/tarjeta/transferencia), cambio físico por otro artículo (calculando la diferencia a cobrar o devolver), y emisión de Saldo a Favor (Monedero Electrónico).
* **Cumplimiento Fiscal:** Si la venta original fue facturada, el sistema gestiona la Nota de Crédito (Egreso) correspondiente o la cancelación del CFDI (si está en periodo permitido), garantizando la cuadratura contable.

---

## 15. Alcance por Versiones (Roadmap Tecnológico)

* **Versión MVP (V1.0):**
* POS completo SaaS Web (Vite + React), NestJS + PostgreSQL (Logical Multitenant), autenticación RBAC, cortes X/Z (ciego/abierto), integración de periféricos (básculas/impresoras), arquitectura Whitelabel total, operación desde el Día 0 con wizard de onboarding, interfaz adaptativa multirol y **Gestión de Devoluciones/Cambios**. Ver [Plan de Desarrollo](/CUDII_POS/.agents/PLAN_DESARROLLO.md).


* **Versión V2.0:**
*  IA conversacional en dashboard, dashboard temporal visual, órdenes de compra a proveedores, crédito y fiados, motor de IA para predicción de compras, migración asistida con IA, integraciones e-commerce y lealtad avanzada. Ver [Plan de Desarrollo](/CUDII_POS/.agents/PLAN_DESARROLLO.md).


* **Versión V3.0:**
* Módulo completo de Restaurantes (Mapa de mesas, comandas, KDS), facturación híbrida CFDI 4.0. Ver [Plan de Desarrollo](/CUDII_POS/.agents/PLAN_DESARROLLO.md)

---

## 8. Documentos de Referencia (Orden Arquitectónico)

| Nivel | Documento | Ruta Absoluta | Descripción |
| :---: | :--- | :--- | :--- |
| 1 | `AGENTS.md` | [/CUDII_POS/.agents/AGENTS.md](/CUDII_POS/.agents/AGENTS.md) | Orquestación, roles de IA y políticas de desarrollo. |
| 2 | `SPEC.md` | [/CUDII_POS/.agents/SPEC.md](/CUDII_POS/.agents/SPEC.md) | Especificación técnica central y modelo de datos multitenant (este archivo). |
| 3 | `BACKEND_STANDARDS.md` | [/CUDII_POS/.agents/BACKEND_STANDARDS.md](/CUDII_POS/.agents/BACKEND_STANDARDS.md) | Estándares de programación del backend NestJS. |
| 4 | `DESIGN_SYSTEM.md` | [/CUDII_POS/.agents/DESIGN_SYSTEM.md](/CUDII_POS/.agents/DESIGN_SYSTEM.md) | Reglas visuales, de interfaz y arquitectura Whitelabel. |
| 5 | `PERIPHERALS_SPEC.md` | [/CUDII_POS/.agents/PERIPHERALS_SPEC.md](/CUDII_POS/.agents/PERIPHERALS_SPEC.md) | Especificación de integración con hardware local. |
| 6 | `REGLAS_NEGOCIO.md` | [/CUDII_POS/.agents/REGLAS_NEGOCIO.md](/CUDII_POS/.agents/REGLAS_NEGOCIO.md) | Lógica de ventas, impuestos, inventario y facturación. |
| 7 | `PLAN_DESARROLLO.md` | [/CUDII_POS/.agents/PLAN_DESARROLLO.md](/CUDII_POS/.agents/PLAN_DESARROLLO.md) | Fases de desarrollo, dependencias y entregables. |
| 8 | `TODO.md` | [/CUDII_POS/TODO.md](/CUDII_POS/TODO.md) | Control de pendientes general y tareas del proyecto. |

