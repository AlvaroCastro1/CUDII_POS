const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');
  
  // 1. Crear Empresa
  const empresa = await prisma.empresa.create({
    data: { nombre: 'Mi Tiendita' }
  });
  console.log(`Empresa creada con ID: ${empresa.id}`);

  // 2. Crear Sucursal
  const sucursal = await prisma.sucursal.create({
    data: { nombre: 'Matriz', empresaId: empresa.id }
  });
  console.log(`Sucursal creada con ID: ${sucursal.id}`);

  // 3. Crear Usuario Admin
  const hash = await argon2.hash('cudii123');
  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Admin',
      email: 'admin@cudii.mx',
      passwordHash: hash,
      rol: 'SUPER_ADMIN',
      empresaId: empresa.id
    }
  });
  
  console.log('=========================================');
  console.log('¡Datos semilla insertados correctamente!');
  console.log(`Email de login: ${usuario.email}`);
  console.log(`Password: cudii123`);
  console.log('=========================================');
}

main()
  .catch(e => {
    console.error('Error al ejecutar el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
