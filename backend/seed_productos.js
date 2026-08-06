const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const empresa = await prisma.empresa.findFirst();
  if (!empresa) {
    console.error('No se encontró empresa');
    process.exit(1);
  }

  const productos = [
    {
      empresaId: empresa.id,
      nombre: 'Arroz San José',
      codigoBarras: '7501234567890',
      codigoInterno: 'ARR-001',
      descripcion: 'Arroz blanco a granel',
      unidadMedida: 'KILO',
      precioCompra: 18.0,
      precioVentaBase: 25.5,
      esGranel: true,
    },
    {
      empresaId: empresa.id,
      nombre: 'Caja Refresco Coca Cola 600ml',
      codigoBarras: '7509876543210',
      codigoInterno: 'CAJ-COCA-600',
      descripcion: 'Caja con 24 piezas',
      unidadMedida: 'CAJA',
      precioCompra: 250.0,
      precioVentaBase: 380.0,
      esGranel: false,
    },
    {
      empresaId: empresa.id,
      nombre: 'Aceite Nutrioli',
      codigoBarras: '7501112223334',
      codigoInterno: 'LIT-NUT-01',
      descripcion: 'Aceite vegetal puro',
      unidadMedida: 'LITRO',
      precioCompra: 35.0,
      precioVentaBase: 48.0,
      esGranel: true,
    },
    {
      empresaId: empresa.id,
      nombre: 'Cable Eléctrico Calibre 12',
      codigoBarras: '7504445556667',
      codigoInterno: 'MET-CAB-12',
      descripcion: 'Cable de cobre con recubrimiento THW',
      unidadMedida: 'METRO',
      precioCompra: 8.5,
      precioVentaBase: 15.0,
      esGranel: true,
    }
  ];

  for (const prod of productos) {
    await prisma.producto.create({
      data: prod
    });
    console.log(`Producto creado: ${prod.nombre}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
