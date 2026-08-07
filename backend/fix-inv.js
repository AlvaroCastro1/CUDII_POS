const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const sucursales = await prisma.sucursal.findMany();
  const productos = await prisma.producto.findMany();
  let added = 0;
  for (const s of sucursales) {
    for (const p of productos.filter(p => p.empresaId === s.empresaId)) {
      const exists = await prisma.inventarioSucursal.findFirst({
        where: { sucursalId: s.id, productoId: p.id }
      });
      if (!exists) {
        await prisma.inventarioSucursal.create({
          data: {
            sucursalId: s.id,
            productoId: p.id,
            stockActual: 0,
            stockMinimo: 0,
            stockMaximo: 0
          }
        });
        added++;
      }
    }
  }
  console.log("Added missing inventory records:", added);
}
run().finally(() => prisma.$disconnect());
