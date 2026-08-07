const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.producto.findMany().then(products => {
  console.log('Total products:', products.length);
  console.log('Inactive:', products.filter(p => !p.estaActivo).length);
}).catch(console.error).finally(() => prisma.$disconnect());
