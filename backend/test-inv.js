const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.producto.findFirst({ where: { codigoBarras: "E2E-1785994452718" } });
  console.log("Producto:", p);
  if (p) {
    const inv = await prisma.inventarioSucursal.findMany({ where: { productoId: p.id } });
    console.log("Inventario:", inv);
  }
}
run().finally(() => prisma.$disconnect());
