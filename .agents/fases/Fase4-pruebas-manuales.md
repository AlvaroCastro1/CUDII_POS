# Fase 4 — Plan de Validación Manual

> **Objetivo:** verificar en vivo que todo lo construido funciona antes de marcar la fase ✅ COMPLETADA.
> **Cómo usar:** ejecuta las tareas en orden (cada bloque prepara datos del siguiente). Marca cada casilla al pasar. Si algo falla, anota el ID de tarea y qué observaste.
> **Referencias [V#]:** pruebas funcionales numeradas de `Fase4.md`.

---

## Preparación

- [ ] **PR-1 · Usuarios por rol** — Existen usuarios activos `ADMIN`, `GERENTE` y `CAJERO` con credenciales a mano.
- [ ] **PR-2 · Datos base** — Con ADMIN: ≥3 productos activos con stock y precio conocidos; 1 producto con stock bajo (para alertas); categoría asignada.
- [ ] **PR-3 · Sesión de caja** — CAJERO abre sesión de caja (queda abierta para todo el plan).
- [ ] **PR-4 · Lealtad base** — Configuración → Programa de Lealtad: habilitado, % devolución `5%`, compra mínima OFF, canje ON mínimo `100`, vencimiento OFF. Guardar.

---

## Bloque A — CRUD de Clientes (D6)

- [ ] **A1 · Crear cliente [V1]** — Clientes → Nuevo Cliente → `Juan Pérez` con teléfono y email → Crear.
  **Esperado:** toast éxito; aparece como Activo.
- [ ] **A2 · Validación formulario** — Submit con nombre vacío.
  **Esperado:** bloqueado por required; no se crea nada.
- [ ] **A3 · Búsqueda** — Buscar por nombre, luego teléfono, luego email.
  **Esperado:** filtra correcto en los tres casos.
- [ ] **A4 · Editar cliente** — Lápiz en fila → modal precargado "Editar Cliente — Juan" → cambiar teléfono → Guardar cambios.
  **Esperado:** toast éxito; fila actualizada.
- [ ] **A5 · Soft delete** — Botón 🚫 → confirmar.
  **Esperado:** estado Inactivo (fila atenuada); cuenta de crédito desactivada si existía.
- [ ] **A6 · Switch "Mostrar inactivos"** — Alternar switch junto al buscador.
  **Esperado:** OFF solo activos; ON incluye inactivos con botón ↺.
- [ ] **A7 · Reactivar** — Switch ON → botón ↺ del cliente inactivo.
  **Esperado:** vuelve a Activo.

---

## Bloque B — Configuración de Lealtad (D10 rediseñado) — rol ADMIN

- [ ] **B1 · Toggle general** — Apagar programa → Guardar → recargar → encender de nuevo.
  **Esperado:** persiste en ambos estados.
- [ ] **B2 · % devolución + ejemplo vivo** — Mover slider 0.5–10 (paso 0.5) mirando el ejemplo del ticket de $500.
  **Esperado:** puntos cambian en vivo ($500×5% = 25 pts); slider e input sincronizados.
- [ ] **B3 · Compra mínima (toggle invertido + input libre)** — Encender "Requerir compra mínima…" → escribir exactamente `100`, luego `37.5` → apagar.
  **Esperado:** ON prellena $100 editable; acepta cualquier valor SIN sugerir "válidos más cercanos"; OFF oculta input.
- [ ] **B4 · Base de cálculo** — Alternar cards CON_DESCUENTO / SIN_DESCUENTO y guardar.
  **Esperado:** check visual en la elegida; persiste tras recargar.
- [ ] **B5 · Canje** — Activar canje → cambiar mínimo entre `100` y `50` → observar semáforo, chips y tooltip.
  **Esperado:** card verde ON / gris OFF; input acepta cualquier entero; semáforo 🟢🟡🔴 reacciona; tooltip explica reglas y que canjear no baja el nivel.
- [ ] **B6 · Editor de niveles** — Agregar nivel (prellenado umbral=último×2, desc=+2); duplicar umbral existente; poner descuento ≥20%; cambiar color; eliminar un nivel.
  **Esperado:** duplicado → error rojo inline; ≥20% → aviso ámbar sin bloqueo; color aplicable; eliminar confirma.
- [ ] **B7 · Advertencias no bloquean** — Dejar una config que dispare advertencia → Guardar.
  **Esperado:** banners ámbar + toasts warning, PERO guarda igual (solo advierte, nunca impide).
- [ ] **B8 · Persistencia** — Recargar página de configuración.
  **Esperado:** todo lo guardado sigue intacto.
- [ ] **B9 · Vencimiento D11 (toggle invertido)** — Encender "Los puntos vencen después de un tiempo" → revisar ejemplo de fecha → probar valores (12, luego 1) → apagar ("nunca vencen").
  **Esperado:** ON prellena 12 meses editable (acepta cualquier entero); muestra fecha calculada coherente; tooltip explica caducidad por lote.

## Bloque C — Lealtad en Ventas POS (D6 + D10)

> Con CAJERO en el POS. Cliente de prueba: `Juan Pérez` con nivel que otorgue descuento (configura un nivel "Oro" umbral 0, descuento 5%, y asígnalo dejando puntos ≥ umbral).

- [ ] **C1 · Descuento por nivel [V12]** — Venta de $1,000 a Juan (Oro 5%).
  **Esperado:** línea de descuento −$50 automática; total $950; el chip del cliente muestra su nivel/descuento.
- [ ] **C2 · Acumulación de puntos** — Misma venta u otra de total conocido.
  **Esperado:** puntos = base × 5%. Con base CON_DESCUENTO sobre $950 → 47 pts; verifica en chip tras venta y en detalle del cliente.
- [ ] **C3 · Base SIN_DESCUENTO** — Cambiar config a SIN_DESCUENTO → repetir venta similar.
  **Esperado:** ahora los puntos se calculan sobre $1,000 → 50 pts (diferencia visible vs C2).
- [ ] **C4 · Compra mínima respeta monto** — Config mínimo $300 → vender $250 con cliente; luego $350.
  **Esperado:** $250 → 0 puntos; $350 → puntos normales.
- [ ] **C5 · Canje exitoso [V14]** — Darle a Juan 250 pts (vendiendo o por BD asistida) → canje habilitado, mínimo 100 → en checkout canjear 200 pts.
  **Esperado:** descuento de $2.00 en la venta; saldo queda 50 pts; movimiento CANJEADO −200; **el nivel NO baja**.
- [ ] **C6 · Rechazos de canje** — Intentar: canjear más pts de los disponibles; canjear 90 (< mínimo); con permitirCanje OFF.
  **Esperado:** error claro en los dos primeros; con canje OFF el campo no aparece o está bloqueado.
- [ ] **C7 · Programa deshabilitado [V13]** — ADMIN apaga el programa → CAJERO vende con cliente.
  **Esperado:** sin puntos, sin descuento, sin canje; UI de lealtad oculta en POS y columnas fuera en ClientesView. Reactivar después.

---

## Bloque D — Crédito / Fiados (D6)

> Rol ADMIN/GERENTE para apertura de cuenta. Usa un cliente nuevo `Laura Crédito`.

- [ ] **D1 · Abrir cuenta [V2]** — Detalle de Laura → límite $2,000, días 30 → Abrir crédito.
  **Esperado:** sección crédito activa mostrando límite y saldo $0.
- [ ] **D2 · Venta a crédito [V3]** — POS: venta de $500 a Laura pagando con método "crédito".
  **Esperado:** deuda creada; saldoPendiente $500; disponible baja a $1,500; visible en FiadosView como pendiente.
- [ ] **D3 · Rechazo por límite [V4]** — Venta a crédito de $1,600 (disponible solo $1,500).
  **Esperado:** rechazo con mensaje claro (422); NO se crea deuda ni venta.
- [ ] **D4 · Abono parcial [V5]** — FiadosView/Detalle → abonar $300 (efectivo).
  **Esperado:** saldoPendiente $200; estado `parcialmente_pagada`; abono listado con fecha/método.
- [ ] **D5 · FIFO entre dos deudas** — Nueva venta a crédito $400 (deuda #2) → abono único de $600.
  **Esperado:** paga primero la deuda vieja ($200 restantes → `liquidada`) y aplica $200 a la nueva (queda $250, `parcialmente_pagada`).
- [ ] **D6 · Liquidación total** — Abonar los $250 restantes.
  **Esperado:** deuda #2 en `liquidada`; saldo de cuenta $0; disponible restaurado al límite.

## Bloque E — Detalle de Cliente y Página de Venta

- [ ] **E1 · Detalle completo** — "Ver detalle" de Juan.
  **Esperado:** badge de nivel con su color, puntos actuales/históricos, % descuento, cuenta crédito (si aplica), botón "Editar datos", modales SIN blur de fondo.
- [ ] **E2 · Últimas compras paginadas** — Asegura que Juan tenga >5 ventas (vende rápido o asistido por BD) → abre su detalle.
  **Esperado:** lista de 5 en 5 con controles "Mostrando X–Y de Z" y flechas funcionales.
- [ ] **E3 · Folio → pestaña nueva** — Clic sobre el folio de una venta.
  **Esperado:** abre `/admin/ventas/:id` en pestaña NUEVA manteniendo la sesión; la vista original no cambia.
- [ ] **E4 · Contenido de la página de venta** — Revisa la página abierta.
  **Esperado:** folio/fecha/cajero, badge de estado, tabla de productos (nombre, cantidad+unidad, precio, total), subtotal/descuento/impuestos/total correctos y chips de pagos con cambio.
- [ ] **E5 · Card Lealtad en la página** — Compara con cómo se hizo esa venta.
  **Esperado:** venta con cliente acumulada → "+N pts · Generó puntos para {cliente}" (+fecha vencimiento si aplica); canje → "−N pts Canje realizado"; venta sin cliente → mensaje correspondiente; cliente bajo mínimo → aviso de no generación de puntos.
- [ ] **E6 · Movimientos recientes (D11)** — En detalle del cliente, sección Lealtad.
  **Esperado:** lista GANADO/CANJEADO/EXPIRADO con badges de color, ±puntos, fecha y vencimiento cuando aplique.

---

## Bloque F — Caducidad de Puntos (D11)

- [ ] **F1 · Venta con vencimiento** — ADMIN: activa vencimiento = `1` mes → CAJERO vende $200 a Juan → revisa movimientos en su detalle.
  **Esperado:** movimiento GANADO +pts con "vence el" = fecha de hoy + 1 mes (también visible en la página de la venta).
- [ ] **F2 · FIFO en canje** — Con un lote viejo y uno nuevo (dos compras en fechas distintas), canjear puntos.
  **Esperado:** el remanente consumido sale primero del lote más viejo (visible en puntosConsumidos/movimientos).
- [ ] **F3 · Expiración real (ASISTIDA)** — Coordinar: el desarrollador atrasa `expiraEn` de un lote vía SQL y reinicia la API; el job corre ~15 s después del arranque.
  **Esperado:** movimiento EXPIRADO −N creado; puntosActuales e históricos bajan; nivel recalculado si cruza umbral; log `[Lealtad D11]` en la consola de la API. *(Esta prueba ya pasó E2E en su día; repetirla es opcional.)*
- [ ] **F4 · Restaurar configuración** — Al terminar el bloque, dejar el vencimiento como se desee en producción (OFF u ON).

## Bloque G — Dashboard (D7) — rol GERENTE/ADMIN

- [ ] **G1 · KPIs del día** — Compara las tarjetas con las ventas reales hechas hoy en este plan.
  **Esperado:** total vendido, # transacciones, ticket promedio y efectivo vs tarjeta coinciden.
- [ ] **G2 · Gráficas** — Ventas por hora y top 5 productos.
  **Esperado:** barras coherentes con los tickets de hoy; el top 5 refleja lo más vendido.
- [ ] **G3 · Widgets** — Créditos próximos a vencer, últimas ventas, estado de cajas.
  **Esperado:** la deuda de Laura aparece; feed con las últimas ventas; caja del CAJERO como abierta; badge rojo del producto con stock bajo (PR-2).
- [ ] **G4 · Actualización automática** — Vende algo y espera ~30 s sin recargar.
  **Esperado:** el dashboard refresca solo e incluye la venta.

## Bloque H — Reportes + CSV (D8) — ADMIN/GERENTE/CONTADOR

- [ ] **H1 · Resumen de ventas [V7]** — Rango = hoy.
  **Esperado:** cifras idénticas a las ventas reales del día.
- [ ] **H2 · Top productos** — Rango = hoy.
  **Esperado:** ranking coherente con lo vendido en las pruebas.
- [ ] **H3 · Inventario con alertas [V8]** — Sin filtros.
  **Esperado:** el producto con stock bajo de PR-2 aparece marcado.
- [ ] **H4 · Cortes de caja** — Histórico de cortes X/Z.
  **Esperado:** lista con los cortes existentes y diferencias visibles; vacío si nunca se cortó (sin error).
- [ ] **H5 · Margen** — Por producto/categoría.
  **Esperado:** margen calculado con costos históricos; productos sin costo no rompen la vista.
- [ ] **H6 · Descarga CSV** — Botón/`?format=csv` en cada reporte.
  **Esperado:** descarga un .csv que abre correctamente con los mismos datos.
- [ ] **H7 · Filtros** — Cambiar fechas y sucursal.
  **Esperado:** resultados cambian coherentemente; rango inválido no crashea.

## Bloque I — Devoluciones y Endpoints Huérfanos (D9)

- [ ] **I1 · Historial de devoluciones [V10]** — DevolucionesView: pestaña/lista de historial.
  **Esperado:** muestra devoluciones previas (haz una si está vacía) con folio, fecha y monto.
- [ ] **I2 · Flujo de devolución** — Devolver 1 unidad de una venta reciente.
  **Esperado:** stock regresa, movimiento de inventario registrado; aparece en el historial (I1).
- [ ] **I3 · Recepciones en Inventario** — Abrir historial de recepciones.
  **Esperado:** lista las recepciones previas sin error.
- [ ] **I4 · Verificar vencidos (Lotes)** — Botón "Verificar vencidos".
  **Esperado:** responde OK y marca lotes vencidos/próximos si existen.
- [ ] **I5 · Corte X** — En la vista de caja, botón "Corte X" mid-shift.
  **Esperado:** genera informe parcial con totales de la sesión sin cerrarla.

---

## Bloque J — RBAC Sidebar (D9) [V11]

Cierra sesión entre cada rol.

- [ ] **J1 · CAJERO** — Solo ve: POS, Clientes, Devoluciones.
- [ ] **J2 · GERENTE** — Lo anterior + Inventario, Reportes, Dashboard, Proveedores (sin Usuarios/Categorías/Auditoría/Configuración).
- [ ] **J3 · ADMIN** — Menú completo (+ Usuarios, Categorías, Auditoría, Configuración).
- [ ] **J4 · URL directa bloqueada** — Como CAJERO navegar manualmente a `/admin/configuracion` y `/admin/usuarios`.
  **Esperado:** redirección fuera (no se renderiza la vista).

## Bloque K — Cimientos Técnicos verificables en UI (D0–D4)

- [ ] **K1 · Paginación estandarizada [V9]** — DevTools → Network → abrir vistas con tablas (ventas/devoluciones/proveedores/lotes).
  **Esperado:** respuestas con formato `{ data: [...], meta: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }`; los controles de paginación funcionan en todas.
- [ ] **K2 · CORS** — Usar la app completa desde `localhost:5173` (login, POS, reportes) con la consola abierta.
  **Esperado:** cero errores CORS; todas las llamadas pasan.
- [ ] **K3 · Route collisions resueltos** — Campana de notificaciones → "Marcar todas como leídas"; Proveedores → reactivar uno inactivo.
  **Esperado:** ambas acciones responden 200 y aplican el cambio (sin 404).
- [ ] **K4 · Campos muertos ausentes (D0)** — Crear venta/abrir caja y revisar payloads en Network.
  **Esperado:** no se envía ni muestra campo `notas`; no hay campos direccionIP/agenteUsuario visibles.

---

## Rendimiento

- [ ] **P1 · Venta grande fluida [perf1]** — Venta con ≥10 items distintos.
  **Esperado:** confirma sin cuelgues perceptibles (<2 s). *El conteo de queries (<25 vs 80+) lo mido yo en logs al cierre.*
- [ ] **P2 · Listados rápidos [perf2]** — Network tab: tiempo de `GET /sales`, clientes, lotes.
  **Esperado:** respuestas <200 ms con volumen actual.
- [ ] **P3 · Lotes sin N+1 [perf3]** — Abrir LotesView con lotes vencidos presentes.
  **Esperado:** carga fluida; verificación de queries por mi parte al cierre.

---

## Cierre

- [ ] **CIERRE-1** — Todos los bloques marcados. Reportarme cualquier fallo con su ID para corregir antes del cierre.
- [ ] **CIERRE-2 (automático, lo ejecuto yo)** — conteo de queries venta 10-items vía logs, verificación de índices en BD (`pg_indexes`), revisión de errores en logs de API/frontend durante toda la sesión.
- [ ] **CIERRE-3** — Al aprobar todo: actualizar `Fase4.md` a ✅ COMPLETADA y registrar en `TODO.md`.






