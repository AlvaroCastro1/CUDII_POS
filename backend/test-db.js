const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany();
  console.log('ALL USERS:', JSON.stringify(usuarios, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
