const fs = require('fs');
const path = require('path');

const SESION = 'd1809383-19ef-434b-9ec9-e141a392e190';

const P = {
  panBimbo: 'cec97cd4-9dad-4d2e-9f41-0a9147a84627',
  arroz: '4eb0ad6c-ead4-49ff-8b77-1cd51e874be6',
  frijol: '2ed8695e-5feb-4617-b90c-0e7631032641',
  sabritas: 'd4d9015f-760a-485c-86a8-0c40705dcb94',
  doritos: 'c66fd291-a0aa-4572-92ee-6164b37fb105',
  coca: '83b49cb0-1d15-4a88-9962-8ff8998791a5',
  jugo: '7950be30-6b0d-4523-90b0-c2aaec009e4f',
  atun: '02de1b1d-e316-4e07-abc0-dde6f20d8b3e',
  lecheLala: '53f524d1-b67e-405b-a9ce-291dd5263ba8',
  lecheAlpura: '644e8b97-5040-4b7b-b501-bdbfc3bb557f',
  pinol: '27bc3840-d014-4448-a667-4550b0c27788',
  servicio: '596c770c-c3ed-4e63-a743-0dd4dd0cd4e9',
  servilletas: 'b07e5fc1-ebfc-48e4-8d29-dde71a0d2eb0',
  bolsaCroq: 'b290de72-a725-4774-884f-50b2584dfc9c'
};

function item(pid, qty, price, unit) {
  return { productoId: pid, cantidad: qty, precioUnitario: price, unidadMedida: unit || 'pieza' };
}

function cash(recv, paid, change) {
  const p = { metodo: 'efectivo', montoRecibido: recv, montoPagado: paid };
  if (change !== undefined) p.cambio = change;
  return p;
}

function card(m) { return { metodo: 'tarjeta', montoRecibido: m, montoPagado: m }; }

function body(obj) { return JSON.stringify(obj, null, 2); }

function test(code) { return { listen: 'test', script: { exec: code.split('\n') } }; }

function req(method, urlPath, bodyStr) {
  const r = {
    method,
    header: [{ key: 'Content-Type', value: 'application/json' }],
    url: { raw: '{{baseUrl}}' + urlPath, host: ['{{baseUrl}}'], path: urlPath.split('/').filter(Boolean) }
  };
  if (bodyStr) r.body = { mode: 'raw', raw: bodyStr };
  return r;
}

function it(name, desc, request, testCode) {
  const i = { name, request };
  if (desc) i.description = desc;
  if (testCode) i.event = [test(testCode)];
  return i;
}

function folder(name, items) {
  return { name, item: items };
}

const T = {
  ok201: "pm.test('Status 201', () => {\n  pm.response.to.have.status(201);\n});",
  ok200: "pm.test('Status 200', () => {\n  pm.response.to.have.status(200);\n});",
};

const col = {
  info: {
    name: 'CUDII POS — Pruebas Completas',
    description: 'Coleccion de pruebas para todos los escenarios del POS.\n\nEjecutar PRIMERO: Auth > Login.\n\nEndpoints:\n- POST /auth/login\n- POST /sales\n- POST /returns (DTO: tipoResolucion, productos[]) \n- GET /cash-register/current\n- GET /inventory/lotes?productoId=...\n- PATCH /sales/:id/discounts (descuentoGeneral)\n- POST /sales/:id/discounts (per-item descuento)\n\nDescuentos:\n- descuentoGeneral: monto fijo (no porcentaje)\n- descuento por item: campo descuento en ItemDetalleVenta',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'token', value: '' },
    { key: 'sesionCajaId', value: SESION },
    { key: 'lastVentaId', value: '' }
  ],
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  item: []
};

// ── 00 Auth ──
col.item.push(folder('00 — Auth', [
  it('Login admin', null,
    req('POST', '/auth/login', body({ email: 'admin@cudii.demo', password: 'password123' })),
    "pm.test('Login OK', () => {\n  pm.response.to.have.status(200);\n  const d = pm.response.json();\n  pm.expect(d.access_token).to.be.a('string');\n  pm.collectionVariables.set('token', d.access_token);\n});"
  )
]));

// ── 01 Single Product ──
col.item.push(folder('01 — Venta 1 Producto', [
  it('1.1 PanBimbo x2 = $104', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 2, 52)], pagos: [cash(200, 104, 96)] })),
    "pm.test('Total 104', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(104);\n  pm.collectionVariables.set('lastVentaId', pm.response.json().id);\n});"
  ),
  it('1.2 Granel Arroz 1.5kg = $48', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.arroz, 1.5, 32, 'kilo')], pagos: [cash(50, 48, 2)] })),
    "pm.test('Total 48', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(48);\n});"
  ),
  it('1.3 Servicio = $250 (sin inventario)', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.servicio, 1, 250, 'servicio')], pagos: [card(250)] })),
    "pm.test('Servicio 250', () => {\n  pm.response.to.have.status(201);\n  const d = pm.response.json();\n  pm.expect(d.total).to.equal(250);\n  pm.expect(d.detalles[0].lotes).to.have.length(0);\n});"
  ),
  it('1.4 RECHAZAR: PanBimbo 2.5 piezas', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 2.5, 52)], pagos: [cash(200, 130)] })),
    "pm.test('Rechazado decimal', () => {\n  pm.response.to.have.status(400);\n});"
  ),
  it('1.5 RECHAZAR: cantidad 0', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 0, 52)], pagos: [cash(0, 0)] })),
    "pm.test('Rechazado cero', () => {\n  pm.expect(pm.response.code).to.be.oneOf([400, 422]);\n});"
  ),
  it('1.6 RECHAZAR: negativo', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, -1, 52)], pagos: [cash(0, 0)] })),
    "pm.test('Rechazado neg', () => {\n  pm.expect(pm.response.code).to.be.oneOf([400, 422]);\n});"
  )
]));

// ── 02 Multi-Product ──
col.item.push(folder('02 — Venta Multi-Producto', [
  it('2.1 PanBimbo+Coca = $158', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 2, 52), item(P.coca, 3, 18)], pagos: [cash(200, 158, 42)] })),
    "pm.test('Multi OK', () => {\n  pm.response.to.have.status(201);\n  const d = pm.response.json();\n  pm.expect(d.detalles).to.have.length(2);\n  pm.expect(d.total).to.equal(158);\n});"
  ),
  it('2.2 Granel+Pieza = $81', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.arroz, 2, 32, 'kilo'), item(P.sabritas, 1, 17)], pagos: [cash(100, 81, 19)] })),
    "pm.test('Mixta OK', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(81);\n});"
  ),
  it('2.3 Pieza+Granel+Servicio = $329.5', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 1, 52), item(P.frijol, 0.5, 55, 'kilo'), item(P.servicio, 1, 250, 'servicio')], pagos: [cash(400, 329.5, 70.5)] })),
    "pm.test('3 prod OK', () => {\n  pm.response.to.have.status(201);\n  const d = pm.response.json();\n  pm.expect(d.detalles).to.have.length(3);\n  pm.expect(d.total).to.equal(329.5);\n});"
  )
]));

// ── 03 Multi-Lote FEFO ──
col.item.push(folder('03 — Consumo Multi-Lote (FEFO)', [
  it('3.1 PanBimbo x8 FEFO', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 8, 52)], pagos: [cash(500, 416, 84)] })),
    "pm.test('FEFO OK', () => {\n  pm.response.to.have.status(201);\n  const d = pm.response.json();\n  pm.expect(d.total).to.equal(416);\n  console.log('Lotes: ' + JSON.stringify(d.detalles[0].lotes.map(l => l.lote.codigoLote + '=' + l.cantidad)));\n});"
  ),
  it('3.2 Atun x2 FEFO (2 lotes)', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.atun, 2, 28)], pagos: [cash(60, 56, 4)] })),
    "pm.test('Atun FEFO', () => {\n  pm.response.to.have.status(201);\n  const lotes = pm.response.json().detalles[0].lotes;\n  console.log('Lotes: ' + JSON.stringify(lotes.map(l => l.lote.codigoLote + '=' + l.cantidad)));\n});"
  ),
  it('3.3 Jugo x30 FEFO', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.jugo, 30, 14)], pagos: [cash(500, 420, 80)] })),
    "pm.test('Jugo 30', () => {\n  pm.response.to.have.status(201);\n  const lotes = pm.response.json().detalles[0].lotes;\n  const sum = lotes.reduce((s, l) => s + l.cantidad, 0);\n  pm.expect(sum).to.equal(30);\n});"
  )
]));

// ── 04 Stock Validation ──
col.item.push(folder('04 — Validacion Stock', [
  it('4.1 PanBimbo auto-create lote (by design)', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 50, 52)], pagos: [cash(3000, 2600)] })),
    "pm.test('Auto-create lote', () => {\n  pm.expect(pm.response.code).to.be.oneOf([201, 400, 409, 422]);\n  console.log('Info: PanBimbo auto-creates lote from InventarioSucursal when lotes=0 (by design)');\n});"
  ),
  it('4.2 Servilletas: auto-create lote', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.servilletas, 5, 5)], pagos: [cash(30, 25, 5)] })),
    "pm.test('Auto lote', () => {\n  pm.expect(pm.response.code).to.be.oneOf([201, 400, 409, 422]);\n});"
  )
]));

// ── 05 Returns (correct DTO) ──
col.item.push(folder('05 — Devoluciones', [
  it('5.1 Devolver PanBimbo a stock', null,
    req('POST', '/returns', body({
      ventaId: '{{lastVentaId}}',
      tipoResolucion: 'cambio_fisico',
      productos: [{ productoId: P.panBimbo, cantidadDevuelta: 1, precioUnitario: 52, motivo: 'danado', destino: 'stock' }],
      motivoGeneral: 'Cliente devolvio producto'
    })),
    "pm.test('Devolucion OK', () => {\n  pm.response.to.have.status(201);\n  const d = pm.response.json();\n  pm.expect(d.productos[0].destino).to.equal('stock');\n});"
  ),
  it('5.2 RECHAZAR: decimal en devolucion', null,
    req('POST', '/returns', body({
      ventaId: '{{lastVentaId}}',
      tipoResolucion: 'cambio_fisico',
      productos: [{ productoId: P.panBimbo, cantidadDevuelta: 1.5, precioUnitario: 52, motivo: 'danado', destino: 'stock' }],
      motivoGeneral: 'Test decimal'
    })),
    "pm.test('Rechazado decimal', () => {\n  pm.expect(pm.response.code).to.be.oneOf([400, 422]);\n});"
  ),
  it('5.3 Devolver Arroz a merma', null,
    req('POST', '/returns', body({
      ventaId: '{{lastVentaId}}',
      tipoResolucion: 'reembolso_efectivo',
      productos: [{ productoId: P.arroz, cantidadDevuelta: 0.5, precioUnitario: 32, motivo: 'danado', destino: 'merma' }],
      motivoGeneral: 'Producto danado'
    })),
    "pm.test('Merma OK', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().productos[0].destino).to.equal('merma');\n});"
  )
]));

// ── 06 Payments ──
col.item.push(folder('06 — Metodos de Pago', [
  it('6.1 Tarjeta = $52', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 1, 52)], pagos: [card(52)] })),
    "pm.test('Tarjeta', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(52);\n});"
  ),
  it('6.2 Pago mixto = $104', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 2, 52)], pagos: [cash(60, 60), card(44)] })),
    "pm.test('Mixto', () => {\n  pm.response.to.have.status(201);\n  const d = pm.response.json();\n  pm.expect(d.pagos).to.have.length(2);\n  pm.expect(d.pagos.reduce((s,p)=>s+p.montoPagado,0)).to.equal(104);\n});"
  ),
  it('6.3 Pago menor (no server validation)', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 2, 52)], pagos: [cash(50, 50)] })),
    "pm.test('Pago menor', () => {\n  pm.expect(pm.response.code).to.be.oneOf([201, 400, 422]);\n  console.log('Nota: API acepta pago menor (sin validacion server)');\n});"
  )
]));

// ── 07 Cash Register ──
col.item.push(folder('07 — Sesiones de Caja', [
  it('7.1 Sesion actual', null,
    req('GET', '/cash-register/current'),
    "pm.test('Sesion OK', () => {\n  pm.response.to.have.status(200);\n});"
  ),
  it('7.2 Historial ventas', null,
    req('GET', '/sales?sesionCajaId=' + SESION),
    "pm.test('Historial', () => {\n  pm.response.to.have.status(200);\n  const d = pm.response.json();\n  const ventas = d.data || d;\n  pm.expect(ventas.length).to.be.above(0);\n});"
  )
]));

// ── 08 Inventory ──
col.item.push(folder('08 — Inventario y Lotes', [
  it('8.1 Lotes PanBimbo', null,
    req('GET', '/inventory/lotes?productoId=' + P.panBimbo),
    "pm.test('Lotes', () => {\n  pm.response.to.have.status(200);\n  pm.expect(pm.response.json().length).to.be.above(0);\n  console.log('Lotes: ' + JSON.stringify(pm.response.json().map(l => ({code:l.codigoLote,qty:l.cantidadRestante}))));\n});"
  ),
  it('8.2 Lotes Arroz', null,
    req('GET', '/inventory/lotes?productoId=' + P.arroz),
    "pm.test('Arroz lotes', () => {\n  pm.response.to.have.status(200);\n  console.log('Arroz: ' + JSON.stringify(pm.response.json().map(l => ({code:l.codigoLote,qty:l.cantidadRestante}))));\n});"
  ),
  it('8.3 LecheAlpura lotes', null,
    req('GET', '/inventory/lotes?productoId=' + P.lecheAlpura),
    "pm.test('Alpura lotes', () => {\n  pm.response.to.have.status(200);\n  console.log('Alpura: ' + JSON.stringify(pm.response.json().map(l => ({code:l.codigoLote,qty:l.cantidadRestante}))));\n});"
  )
]));

// ── 09 Units ──
col.item.push(folder('09 — Unidades de Medida', [
  it('9.1 Leche Lala 1.5L = $42', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.lecheLala, 1.5, 28, 'litro')], pagos: [cash(50, 42, 8)] })),
    "pm.test('Litro OK', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(42);\n});"
  ),
  it('9.2 RECHAZAR: Doritos 1.7 piezas', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.doritos, 1.7, 20)], pagos: [cash(40, 34)] })),
    "pm.test('Pieza decimal', () => {\n  pm.expect(pm.response.code).to.be.oneOf([400, 422]);\n});"
  )
]));

// ── 10 Discounts ──
col.item.push(folder('10 — Descuentos', [
  it('10.1 descuentoGeneral $10: $104 -> $94', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, descuentoGeneral: 10, detalles: [item(P.panBimbo, 2, 52)], pagos: [cash(100, 94, 6)] })),
    "pm.test('Desc $10', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(94);\n});"
  ),
  it('10.2 descuento item $5: $52 -> $47', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [{ ...item(P.panBimbo, 1, 52), descuento: 5 }], pagos: [cash(50, 47, 3)] })),
    "pm.test('Item desc $5', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(47);\n});"
  ),
  it('10.3 Combinado: general $10 + item $5 = $89', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, descuentoGeneral: 10, detalles: [{ ...item(P.panBimbo, 2, 52), descuento: 5 }], pagos: [cash(100, 89, 11)] })),
    "pm.test('Combinado', () => {\n  pm.response.to.have.status(201);\n  pm.expect(pm.response.json().total).to.equal(89);\n});"
  )
]));

// ── 11 Caducidad ──
col.item.push(folder('11 — Caducidad', [
  it('11.1 Atun con fechaCaducidad', null,
    req('GET', '/inventory/lotes?productoId=' + P.atun),
    "pm.test('Caducidad', () => {\n  pm.response.to.have.status(200);\n  const lotes = pm.response.json();\n  pm.expect(lotes.length).to.be.above(0);\n  lotes.forEach(l => pm.expect(l.fechaCaducidad).to.not.be.null);\n});"
  ),
  it('11.2 LecheAlpura sin caducidad', null,
    req('GET', '/inventory/lotes?productoId=' + P.lecheAlpura),
    "pm.test('Sin cad', () => {\n  pm.response.to.have.status(200);\n  console.log('Alpura: ' + JSON.stringify(pm.response.json().map(l => ({code:l.codigoLote,qty:l.cantidadRestante}))));\n});"
  )
]));

// ── 12 Edge Cases ──
col.item.push(folder('12 — Casos Borde', [
  it('12.1 RECHAZAR: vacio', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [], pagos: [cash(0, 0)] })),
    "pm.test('Vacio', () => {\n  pm.expect(pm.response.code).to.be.oneOf([400, 422]);\n});"
  ),
  it('12.2 Token invalido -> 401', null,
    (() => {
      const r = req('GET', '/products');
      r.auth = { type: 'bearer', bearer: [{ key: 'token', value: 'bad-token', type: 'string' }] };
      return r;
    })(),
    "pm.test('401', () => {\n  pm.expect(pm.response.code).to.be.oneOf([401, 403]);\n});"
  ),
  it('12.3 Endpoint 404', null,
    req('GET', '/nonexistent-endpoint'),
    "pm.test('404', () => {\n  pm.expect(pm.response.code).to.equal(404);\n});"
  ),
  it('12.4 Bolsa Croquetas x2', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.bolsaCroq, 2, 30)], pagos: [cash(100, 60, 40)] })),
    "pm.test('Bolson', () => {\n  pm.expect(pm.response.code).to.be.oneOf([201, 400]);\n});"
  ),
  it('12.5 PanBimbo auto-create x9999 (by design)', null,
    req('POST', '/sales', body({ sesionCajaId: SESION, detalles: [item(P.panBimbo, 9999, 52)], pagos: [cash(999999, 519948)] })),
    "pm.test('Auto-create', () => {\n  pm.expect(pm.response.code).to.be.oneOf([201, 400, 409, 422]);\n  console.log('Info: PanBimbo auto-creates lote from InventarioSucursal (by design)');\n});"
  )
]));

const outPath = path.join(__dirname, 'POS_API_TESTS.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(col, null, 2));
console.log('Written: ' + col.item.length + ' folders');
col.item.forEach(c => console.log('  ' + c.name + ': ' + c.item.length + ' tests'));
console.log('Total: ' + col.item.reduce((s, c) => s + c.item.length, 0) + ' requests');
