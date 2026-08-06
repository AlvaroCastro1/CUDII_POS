import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Crear empresa y sucursal
  const empresa = await prisma.empresa.create({
    data: {
      nombre: 'CUDII Demo',
      rfc: 'XAXX010101000',
    }
  });

  const sucursal = await prisma.sucursal.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Matriz',
      direccion: 'Calle Falsa 123',
    }
  });

  // Hash password
  const passwordHash = await argon2.hash('admin123');

  // Crear usuario SUPER_ADMIN
  const user = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Administrador Principal',
      email: 'admin@cudii.mx',
      passwordHash: passwordHash,
      rol: 'SUPER_ADMIN',
      estaActivo: true,
    }
  });

  console.log(`Usuario creado exitosamente: ${user.email} / admin123`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
