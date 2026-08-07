const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const pSearch = {
      OR: [
        { nombre: { contains: 'e2e', mode: 'insensitive' } },
        { codigoBarras: { contains: 'e2e', mode: 'insensitive' } },
        { codigoInterno: { contains: 'e2e', mode: 'insensitive' } },
      ]
    };
    const cSearch = {
      nombre: { contains: 'e2e', mode: 'insensitive' }
    };

    const productosE2E = await prisma.producto.findMany({ where: pSearch });
    const pIds = productosE2E.map(p => p.id);

    console.log(`Borrando ${pIds.length} productos E2E...`);

    if (pIds.length > 0) {
      // 1. Historial Precio
      const histDel = await prisma.historialPrecioProducto.deleteMany({ where: { productoId: { in: pIds } } });
      console.log(`- ${histDel.count} registros de Historial Precio eliminados`);

      // 2. Movimientos Inventario
      const movDel = await prisma.movimientoInventario.deleteMany({ where: { productoId: { in: pIds } } });
      console.log(`- ${movDel.count} movimientos de inventario eliminados`);

      // 3. Inventario Sucursal
      const invDel = await prisma.inventarioSucursal.deleteMany({ where: { productoId: { in: pIds } } });
      console.log(`- ${invDel.count} registros de Inventario Sucursal eliminados`);

      // 4. Precios Por Unidad
      const ppuDel = await prisma.precioPorUnidad.deleteMany({ where: { productoId: { in: pIds } } });
      console.log(`- ${ppuDel.count} precios por unidad eliminados`);

      // 5. Delete Producto
      const prodDel = await prisma.producto.deleteMany({ where: { id: { in: pIds } } });
      console.log(`- ${prodDel.count} productos eliminados`);
    }

    // 6. Delete Categorias E2E
    const categoriasE2E = await prisma.categoria.findMany({ where: cSearch });
    const cIds = categoriasE2E.map(c => c.id);
    console.log(`Borrando ${cIds.length} categorias E2E...`);

    if (cIds.length > 0) {
      // (Productos will have been unlinked or deleted if they cascaded, but Categoria-Producto is many-to-many implicit)
      const catDel = await prisma.categoria.deleteMany({ where: { id: { in: cIds } } });
      console.log(`- ${catDel.count} categorias eliminadas`);
    }
    
    // Also Users with E2E if they exist? The user said "elementos e2e", usually meaning products/categories created by playwright.
    const usuariosE2E = await prisma.usuario.findMany({ where: { nombre: { contains: 'e2e', mode: 'insensitive' } } });
    const uIds = usuariosE2E.map(u => u.id);
    if (uIds.length > 0) {
      // We shouldn't delete users blindly because they might have created HistorialPrecio etc that we need. 
      console.log(`Encontrados ${uIds.length} usuarios E2E, pero se conservarán para no romper dependencias de movimientos`);
    }

    console.log("Limpieza E2E completada con éxito.");
  } catch (error) {
    console.error("Error durante limpieza:", error);
  }
}
run().finally(() => prisma.$disconnect());
