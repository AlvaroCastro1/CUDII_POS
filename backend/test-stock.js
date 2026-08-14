const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prods = await prisma.producto.findMany({
    where: { estaActivo: true },
    include: {
      inventario: true,
    },
  });

  console.log('--- PRODUCTOS E INVENTARIOS ---');
  prods.forEach((p) => {
    const stockTotal = p.inventario.reduce((acc, inv) => acc + inv.stockActual, 0);
    console.log(`- ${p.nombre} (Cód: ${p.codigoBarras}): Stock Total = ${stockTotal}`, p.inventario);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
