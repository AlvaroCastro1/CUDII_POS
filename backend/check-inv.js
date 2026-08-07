const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.producto.findFirst({ where: { codigoBarras: "E2E-1785994452718" } });
  if (p) {
    const inv = await prisma.inventarioSucursal.findMany({ where: { productoId: p.id }, include: { sucursal: true } });
    console.log(JSON.stringify(inv, null, 2));
  } else {
    console.log("Product not found");
  }
}
run().finally(() => prisma.$disconnect());
