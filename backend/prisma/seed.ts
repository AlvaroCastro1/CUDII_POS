import { PrismaClient, TipoMovimientoInventario, Rol, EstadoLote } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando el sembrado de base de datos (Seed)...');

  // Limpiar base de datos si es necesario (opcional)
  // await prisma.movimientoInventario.deleteMany();
  // await prisma.inventarioSucursal.deleteMany();
  // await prisma.precioPorUnidad.deleteMany();
  // await prisma.producto.deleteMany();
  // await prisma.categoria.deleteMany();
  // await prisma.usuario.deleteMany();
  // await prisma.caja.deleteMany();
  // await prisma.sucursal.deleteMany();
  // await prisma.empresa.deleteMany();

  const passwordSuperAdmin = await argon2.hash('password123');

  // Categorías demo
  const categoriasDemoData = [
    { nombre: 'Bebidas', descripcion: 'Refrescos, aguas y bebidas en general', colorHex: '#3b82f6', icono: 'local_cafe' },
    { nombre: 'Abarrotes', descripcion: 'Productos secos y despensa', colorHex: '#f59e0b', icono: 'shopping_basket' },
    { nombre: 'Botanas', descripcion: 'Snacks, frituras y golosinas', colorHex: '#ef4444', icono: 'fastfood' },
    { nombre: 'Lácteos', descripcion: 'Leche, quesos y derivados', colorHex: '#8b5cf6', icono: 'set_meal' },
    { nombre: 'Limpieza', descripcion: 'Productos de aseo e higiene', colorHex: '#10b981', icono: 'cleaning_services' },
    { nombre: 'Panadería', descripcion: 'Pan, bollería y repostería', colorHex: '#f97316', icono: 'bakery_dining' },
    { nombre: 'Enlatados', descripcion: 'Conservas y alimentos enlatados', colorHex: '#6366f1', icono: 'kitchen' },
  ];

  // Productos demo (2 por cada unidad de medida)
  const productosDemoData = [
    { codigoBarras: '7501055300075', nombre: 'Coca-Cola Original 600ml', unidad: 'pieza', esGranel: false, precioCompra: 12.0, precioVenta: 18.0, stock: 150, stockMin: 20, stockMax: 500, categoriaIdx: 0 },
    { codigoBarras: '7501055314072', nombre: 'Agua Ciel 500ml PET', unidad: 'pieza', esGranel: false, precioCompra: 5.0, precioVenta: 9.0, stock: 200, stockMin: 30, stockMax: 600, categoriaIdx: 0 },
    { codigoBarras: '7501003120512', nombre: 'Arroz Morelos Grano Largo', unidad: 'kilo', esGranel: true, precioCompra: 22.0, precioVenta: 32.0, stock: 50, stockMin: 5, stockMax: 200, categoriaIdx: 1 },
    { codigoBarras: '7501000514036', nombre: 'Frijol Flor de Mayo', unidad: 'kilo', esGranel: true, precioCompra: 38.0, precioVenta: 55.0, stock: 30, stockMin: 5, stockMax: 150, categoriaIdx: 1 },
    { codigoBarras: '7501011115668', nombre: 'Sabritas Original 42g', unidad: 'pieza', esGranel: false, precioCompra: 11.5, precioVenta: 17.0, stock: 80, stockMin: 10, stockMax: 300, categoriaIdx: 2 },
    { codigoBarras: '7501011154018', nombre: 'Doritos Nacho 62g', unidad: 'pieza', esGranel: false, precioCompra: 13.0, precioVenta: 19.0, stock: 60, stockMin: 10, stockMax: 250, categoriaIdx: 2 },
    { codigoBarras: '7501020512809', nombre: 'Leche Lala Entera 1 Litro', unidad: 'litro', esGranel: true, precioCompra: 22.0, precioVenta: 28.0, stock: 100, stockMin: 10, stockMax: 400, categoriaIdx: 3 },
    { codigoBarras: '7501000110060', nombre: 'Leche Alpura Semidescremada 1L', unidad: 'litro', esGranel: true, precioCompra: 20.0, precioVenta: 26.0, stock: 80, stockMin: 10, stockMax: 350, categoriaIdx: 3 },
    { codigoBarras: '7501052462122', nombre: 'Pinol Multiusos Lavanda 1L', unidad: 'litro', esGranel: true, precioCompra: 22.0, precioVenta: 32.0, stock: 20, stockMin: 5, stockMax: 100, categoriaIdx: 4 },
    { codigoBarras: '7501032900071', nombre: 'Fabuloso Primavera 1L', unidad: 'litro', esGranel: true, precioCompra: 18.0, precioVenta: 26.0, stock: 25, stockMin: 5, stockMax: 100, categoriaIdx: 4 },
    { codigoBarras: '7500100000011', nombre: 'Tela Manta de Cielo (Metro)', unidad: 'metro', esGranel: true, precioCompra: 18.0, precioVenta: 28.0, stock: 15, stockMin: 2, stockMax: 50, categoriaIdx: 1 },
    { codigoBarras: '7500100000012', nombre: 'Plástico Autoadherible Cocina (Metro)', unidad: 'metro', esGranel: true, precioCompra: 5.0, precioVenta: 8.0, stock: 10, stockMin: 2, stockMax: 50, categoriaIdx: 4 },
  ];

  // Productos con caducidad (traen lotes en el seed)
  const productosConCaducidad = [
    { codigoBarras: '7501027500123', nombre: 'Pan Bimbo Blanco 680g', unidad: 'pieza', esGranel: false, precioCompra: 38.0, precioVenta: 52.0, stock: 40, stockMin: 10, stockMax: 120, categoriaIdx: 5, tieneCaducidad: true },
    { codigoBarras: '7501019200456', nombre: 'Jugo Del Valle 400ml', unidad: 'pieza', esGranel: false, precioCompra: 8.0, precioVenta: 14.0, stock: 60, stockMin: 15, stockMax: 200, categoriaIdx: 0, tieneCaducidad: true },
    { codigoBarras: '7501036000789', nombre: 'Atún Herdez 140g', unidad: 'pieza', esGranel: false, precioCompra: 22.0, precioVenta: 35.0, stock: 48, stockMin: 10, stockMax: 150, categoriaIdx: 6, tieneCaducidad: true },
  ];

  // Productos sin caducidad (trazabilidad por lote, sin fecha de vencimiento)
  const productosSinCaducidad = [
    { codigoBarras: '7501062300321', nombre: 'Harina Maizena 500g', unidad: 'pieza', esGranel: false, precioCompra: 28.0, precioVenta: 42.0, stock: 36, stockMin: 8, stockMax: 100, categoriaIdx: 1, tieneCaducidad: false },
    { codigoBarras: '7501098700654', nombre: 'Papel Higiénico Premium (12 rollos)', unidad: 'pieza', esGranel: false, precioCompra: 65.0, precioVenta: 95.0, stock: 24, stockMin: 5, stockMax: 80, categoriaIdx: 4, tieneCaducidad: false },
  ];

  // Servicio (sin inventario)
  const servicios = [
    { codigoBarras: 'SRV-INST-001', nombre: 'Servicio de Instalación', unidad: 'SERVICIO', esGranel: false, precioCompra: 0, precioVenta: 250.0, stock: 0, stockMin: 0, stockMax: 0, categoriaIdx: 4, tieneCaducidad: false },
  ];

  // Usuarios demo (uno por cada rol)
  const usuariosDemo = [
    { nombre: 'Admin Demo', email: 'admin_demo@demo.com', password: 'Admin1234!', rol: Rol.ADMIN },
    { nombre: 'Gerente Demo', email: 'gerente@demo.com', password: 'Gerente1234!', rol: Rol.GERENTE },
    { nombre: 'Cajero Demo', email: 'cajero@demo.com', password: 'Cajero1234!', rol: Rol.CAJERO },
    { nombre: 'Almacén Demo', email: 'almacen@demo.com', password: 'Almacen1234!', rol: Rol.ALMACEN },
    { nombre: 'Contador Demo', email: 'contador@demo.com', password: 'Contador1234!', rol: Rol.CONTADOR },
  ];

  // 1. Empresa
  const empresa = await prisma.empresa.create({
    data: { nombre: 'Cudii Demo Seed' },
  });
  console.log(`- Empresa creada: ${empresa.nombre}`);

  // 2. Sucursal
  const sucursal = await prisma.sucursal.create({
    data: { nombre: 'Sucursal Matriz', empresaId: empresa.id },
  });
  console.log(`- Sucursal creada: ${sucursal.nombre}`);

  // 3. Caja
  const caja = await prisma.caja.create({
    data: { nombre: 'Caja 01', sucursalId: sucursal.id },
  });

  // 4. Usuario Super Admin
  const superAdmin = await prisma.usuario.create({
    data: {
      nombre: 'Super Administrador',
      email: 'admin@cudii.demo',
      // password123
      passwordHash: passwordSuperAdmin,
      rol: Rol.SUPER_ADMIN,
      empresaId: empresa.id,
    },
  });
  console.log(`- Super Admin creado: ${superAdmin.email}`);

  // 5. Categorías demo
  const categorias = [];
  for (const cat of categoriasDemoData) {
    const res = await prisma.categoria.create({ data: { ...cat, empresaId: empresa.id } });
    categorias.push(res);
  }
  console.log(`- ${categorias.length} Categorías creadas`);

  // 6. Usuarios demo adicionales
  for (const u of usuariosDemo) {
    const hash = await argon2.hash(u.password);
    await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, passwordHash: hash, rol: u.rol, empresaId: empresa.id },
    });
  }
  console.log(`- ${usuariosDemo.length} Usuarios adicionales creados`);

  // 7. Productos demo con inventario y movimiento inicial
  for (const prod of productosDemoData) {
    const categoria = categorias[prod.categoriaIdx];

    const producto = await prisma.producto.create({
      data: {
        empresaId: empresa.id,
        codigoBarras: prod.codigoBarras,
        codigoInterno: `DEMO-${prod.codigoBarras.slice(-4)}`,
        nombre: prod.nombre,
        descripcion: 'Producto demo autogenerado por seed',
        unidadMedida: prod.unidad,
        precioCompra: prod.precioCompra,
        precioVentaBase: prod.precioVenta,
        esGranel: prod.esGranel,
        manejaInventario: true,
        tieneCaducidad: false,
        categorias: { connect: [{ id: categoria.id }] },
      },
    });

    await prisma.precioPorUnidad.create({
      data: {
        productoId: producto.id,
        unidad: prod.unidad,
        cantidadMinima: 1,
        precio: prod.precioVenta,
        esDefault: true,
      },
    });

    await prisma.inventarioSucursal.create({
      data: {
        sucursalId: sucursal.id,
        productoId: producto.id,
        stockActual: prod.stock,
        stockMinimo: prod.stockMin,
        stockMaximo: prod.stockMax,
      },
    });

    await prisma.movimientoInventario.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursal.id,
        tipo: TipoMovimientoInventario.apertura_inicial,
        cantidad: prod.stock,
        stockAnterior: 0,
        stockNuevo: prod.stock,
        motivo: 'Inventario inicial de demostración',
        usuarioId: superAdmin.id,
      },
    });
  }
  console.log(`- ${productosDemoData.length} Productos creados con inventario inicial`);

  // 8. Productos con caducidad + lotes
  const hoy = new Date();
  const productosConLotes = [
    ...productosConCaducidad.map((p, i) => ({
      ...p,
      lotes: [
        { codigoLote: `L-PAN-00${i + 1}-A`, cantidad: Math.floor(p.stock * 0.6), costoUnitario: p.precioCompra, fechaCaducidad: new Date(hoy.getTime() + 15 * 24 * 3600 * 1000), proveedor: 'Panadería Central SA' },
        { codigoLote: `L-PAN-00${i + 1}-B`, cantidad: Math.floor(p.stock * 0.4), costoUnitario: p.precioCompra, fechaCaducidad: new Date(hoy.getTime() + 45 * 24 * 3600 * 1000), proveedor: 'Panadería Central SA' },
      ],
    })),
    ...productosSinCaducidad.map((p, i) => ({
      ...p,
      lotes: [
        { codigoLote: `L-SEC-00${i + 1}`, cantidad: p.stock, costoUnitario: p.precioCompra, fechaCaducidad: null as Date | null, proveedor: 'Distribuidora Nacional' },
      ],
    })),
    ...servicios.map((p) => ({
      ...p,
      lotes: [] as { codigoLote: string; cantidad: number; costoUnitario: number; fechaCaducidad: Date | null; proveedor: string }[],
    })),
  ];

  for (const prod of productosConLotes) {
    const categoria = categorias[prod.categoriaIdx];
    const esServicio = prod.unidad === 'SERVICIO';

    const producto = await prisma.producto.create({
      data: {
        empresaId: empresa.id,
        codigoBarras: prod.codigoBarras,
        codigoInterno: `DEMO-${prod.codigoBarras.slice(-4)}`,
        nombre: prod.nombre,
        descripcion: esServicio ? 'Servicio demo' : 'Producto demo con trazabilidad por lote',
        unidadMedida: prod.unidad,
        precioCompra: prod.precioCompra,
        precioVentaBase: prod.precioVenta,
        esGranel: prod.esGranel,
        manejaInventario: !esServicio,
        tieneCaducidad: prod.tieneCaducidad,
        metodoRotacion: 'FEFO',
        categorias: { connect: [{ id: categoria.id }] },
      },
    });

    await prisma.precioPorUnidad.create({
      data: {
        productoId: producto.id,
        unidad: prod.unidad === 'SERVICIO' ? 'servicio' : prod.unidad,
        cantidadMinima: 1,
        precio: prod.precioVenta,
        esDefault: true,
      },
    });

    if (!esServicio && prod.lotes.length > 0) {
      let stockTotal = 0;

      for (const lote of prod.lotes) {
        const loteCreado = await prisma.lote.create({
          data: {
            empresaId: empresa.id,
            productoId: producto.id,
            sucursalId: sucursal.id,
            codigoLote: lote.codigoLote,
            fechaRecepcion: new Date(),
            fechaFabricacion: null,
            fechaCaducidad: lote.fechaCaducidad,
            cantidadInicial: lote.cantidad,
            cantidadRestante: lote.cantidad,
            costoUnitario: lote.costoUnitario,
            proveedor: lote.proveedor,
            estado: EstadoLote.activo,
            creadoPorId: superAdmin.id,
          },
        });

        await prisma.movimientoInventario.create({
          data: {
            productoId: producto.id,
            sucursalId: sucursal.id,
            loteId: loteCreado.id,
            tipo: TipoMovimientoInventario.compra,
            cantidad: lote.cantidad,
            stockAnterior: stockTotal,
            stockNuevo: stockTotal + lote.cantidad,
            referencia: 'Seed - Recepción inicial',
            motivo: `Recepción de mercancía - Lote ${lote.codigoLote}`,
            usuarioId: superAdmin.id,
          },
        });

        stockTotal += lote.cantidad;
      }

      await prisma.inventarioSucursal.create({
        data: {
          sucursalId: sucursal.id,
          productoId: producto.id,
          stockActual: stockTotal,
          stockMinimo: prod.stockMin,
          stockMaximo: prod.stockMax,
        },
      });
    } else if (!esServicio) {
      await prisma.inventarioSucursal.create({
        data: {
          sucursalId: sucursal.id,
          productoId: producto.id,
          stockActual: prod.stock,
          stockMinimo: prod.stockMin,
          stockMaximo: prod.stockMax,
        },
      });
    }
  }
  console.log(`- ${productosConCaducidad.length + productosSinCaducidad.length + servicios.length} Productos adicionales creados (con trazabilidad y lotes)`);

  console.log('✅ Base de datos poblada exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
