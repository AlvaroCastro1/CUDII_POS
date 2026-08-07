const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const sucursalId = 'all';
    const empresaId = 'faaedc9c-9479-4e44-b1bf-8ae1cabc248f'; // the one from my earlier logs
    const limit = 20;
    const page = 1;
    const search = '';
    const incluirInactivos = true;

    let whereClause = {};
    if (sucursalId === 'all') {
      const sucursales = await prisma.sucursal.findMany({ where: { empresaId } });
      whereClause = { sucursalId: { in: sucursales.map(s => s.id) } };
    }
    
    if (search) {
      whereClause.producto = {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { codigoBarras: { contains: search, mode: 'insensitive' } },
          { codigoInterno: { contains: search, mode: 'insensitive' } }
        ]
      };
      if (!incluirInactivos) {
        whereClause.producto.estaActivo = true;
      }
    } else {
      whereClause.producto = incluirInactivos ? {} : { estaActivo: true };
    }

    const data = await prisma.inventarioSucursal.findMany({
      where: whereClause,
      include: {
        producto: true,
        sucursal: true,
      },
      skip: 0,
      take: 20,
    });
    console.log("Success! Fetched items:", data.length);
  } catch (e) {
    console.error("Prisma error:", e);
  }
}
run().finally(() => prisma.$disconnect());
