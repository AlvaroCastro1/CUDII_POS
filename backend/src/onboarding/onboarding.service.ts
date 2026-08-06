import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { TipoMovimientoInventario } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async initializeTenant(dto: CreateOnboardingDto) {
    // Validación de seguridad: Solo permitir si no hay empresas registradas
    const count = await this.prisma.empresa.count();
    if (count > 0) {
      throw new ForbiddenException('El sistema ya cuenta con una empresa registrada. Por seguridad, el onboarding está deshabilitado.');
    }

    // Cifrar la contraseña del superadmin
    const passwordSuperAdmin = await argon2.hash(dto.adminPass);

    // Categorías demo
    const categoriasDemoData = [
      { nombre: 'Bebidas', descripcion: 'Refrescos, aguas y bebidas en general', colorHex: '#3b82f6', icono: 'local_cafe' },
      { nombre: 'Abarrotes', descripcion: 'Productos secos y despensa', colorHex: '#f59e0b', icono: 'shopping_basket' },
      { nombre: 'Botanas', descripcion: 'Snacks, frituras y golosinas', colorHex: '#ef4444', icono: 'fastfood' },
      { nombre: 'Lácteos', descripcion: 'Leche, quesos y derivados', colorHex: '#8b5cf6', icono: 'set_meal' },
      { nombre: 'Limpieza', descripcion: 'Productos de aseo e higiene', colorHex: '#10b981', icono: 'cleaning_services' },
    ];

    // Productos demo (2 por cada unidad de medida)
    const productosDemoData = [
      // Piezas – Bebidas
      { codigoBarras: '7501055300075', nombre: 'Coca-Cola Original 600ml', unidad: 'pieza', esGranel: false, precioCompra: 12.0, precioVenta: 18.0, stock: 150, stockMin: 20, stockMax: 500, categoriaIdx: 0 },
      { codigoBarras: '7501055314072', nombre: 'Agua Ciel 500ml PET', unidad: 'pieza', esGranel: false, precioCompra: 5.0, precioVenta: 9.0, stock: 200, stockMin: 30, stockMax: 600, categoriaIdx: 0 },
      // Kilos – Abarrotes
      { codigoBarras: '7501003120512', nombre: 'Arroz Morelos Grano Largo', unidad: 'kilo', esGranel: true, precioCompra: 22.0, precioVenta: 32.0, stock: 50, stockMin: 5, stockMax: 200, categoriaIdx: 1 },
      { codigoBarras: '7501000514036', nombre: 'Frijol Flor de Mayo', unidad: 'kilo', esGranel: true, precioCompra: 38.0, precioVenta: 55.0, stock: 30, stockMin: 5, stockMax: 150, categoriaIdx: 1 },
      // Piezas – Botanas
      { codigoBarras: '7501011115668', nombre: 'Sabritas Original 42g', unidad: 'pieza', esGranel: false, precioCompra: 11.5, precioVenta: 17.0, stock: 80, stockMin: 10, stockMax: 300, categoriaIdx: 2 },
      { codigoBarras: '7501011154018', nombre: 'Doritos Nacho 62g', unidad: 'pieza', esGranel: false, precioCompra: 13.0, precioVenta: 19.0, stock: 60, stockMin: 10, stockMax: 250, categoriaIdx: 2 },
      // Litros – Lácteos
      { codigoBarras: '7501020512809', nombre: 'Leche Lala Entera 1 Litro', unidad: 'litro', esGranel: true, precioCompra: 22.0, precioVenta: 28.0, stock: 100, stockMin: 10, stockMax: 400, categoriaIdx: 3 },
      { codigoBarras: '7501000110060', nombre: 'Leche Alpura Semidescremada 1L', unidad: 'litro', esGranel: true, precioCompra: 20.0, precioVenta: 26.0, stock: 80, stockMin: 10, stockMax: 350, categoriaIdx: 3 },
      // Litros – Limpieza
      { codigoBarras: '7501052462122', nombre: 'Pinol Multiusos Lavanda 1L', unidad: 'litro', esGranel: true, precioCompra: 22.0, precioVenta: 32.0, stock: 20, stockMin: 5, stockMax: 100, categoriaIdx: 4 },
      { codigoBarras: '7501032900071', nombre: 'Fabuloso Primavera 1L', unidad: 'litro', esGranel: true, precioCompra: 18.0, precioVenta: 26.0, stock: 25, stockMin: 5, stockMax: 100, categoriaIdx: 4 },
      // Metros – Abarrotes / Limpieza
      { codigoBarras: '7500100000011', nombre: 'Tela Manta de Cielo (Metro)', unidad: 'metro', esGranel: true, precioCompra: 18.0, precioVenta: 28.0, stock: 15, stockMin: 2, stockMax: 50, categoriaIdx: 1 },
      { codigoBarras: '7500100000012', nombre: 'Plástico Autoadherible Cocina (Metro)', unidad: 'metro', esGranel: true, precioCompra: 5.0, precioVenta: 8.0, stock: 10, stockMin: 2, stockMax: 50, categoriaIdx: 4 },
    ];

    // Usuarios demo (uno por cada rol)
    const usuariosDemo = [
      { nombre: 'Admin Demo', email: 'admin@demo.com', password: 'Admin1234!', rol: 'ADMIN' as const },
      { nombre: 'Gerente Demo', email: 'gerente@demo.com', password: 'Gerente1234!', rol: 'GERENTE' as const },
      { nombre: 'Cajero Demo', email: 'cajero@demo.com', password: 'Cajero1234!', rol: 'CAJERO' as const },
      { nombre: 'Almacén Demo', email: 'almacen@demo.com', password: 'Almacen1234!', rol: 'ALMACEN' as const },
      { nombre: 'Contador Demo', email: 'contador@demo.com', password: 'Contador1234!', rol: 'CONTADOR' as const },
    ];

    // Ejecutar Transacción Atómica
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Empresa
      const empresa = await tx.empresa.create({
        data: { nombre: dto.businessName },
      });

      // 2. Sucursal
      const sucursal = await tx.sucursal.create({
        data: { nombre: dto.branchName, empresaId: empresa.id },
      });

      // 3. Caja
      const caja = await tx.caja.create({
        data: { nombre: dto.registerId, sucursalId: sucursal.id },
      });

      // 4. Usuario Super Admin (el que creó el sistema desde el wizard)
      const superAdmin = await tx.usuario.create({
        data: {
          nombre: 'Super Administrador',
          email: dto.adminEmail,
          passwordHash: passwordSuperAdmin,
          rol: 'SUPER_ADMIN',
          empresaId: empresa.id,
        },
      });

      // 5. Categorías demo
      const categorias = await Promise.all(
        categoriasDemoData.map(cat =>
          tx.categoria.create({ data: { ...cat, empresaId: empresa.id } })
        )
      );

      // 6. Usuarios demo adicionales
      await Promise.all(
        usuariosDemo.map(async u => {
          const hash = await argon2.hash(u.password);
          return tx.usuario.create({
            data: { nombre: u.nombre, email: u.email, passwordHash: hash, rol: u.rol, empresaId: empresa.id },
          });
        })
      );

      // 7. Productos demo con inventario y movimiento inicial
      for (const prod of productosDemoData) {
        const categoria = categorias[prod.categoriaIdx];

        const producto = await tx.producto.create({
          data: {
            empresaId: empresa.id,
            codigoBarras: prod.codigoBarras,
            codigoInterno: `DEMO-${prod.codigoBarras.slice(-4)}`,
            nombre: prod.nombre,
            descripcion: 'Producto demo autogenerado',
            unidadMedida: prod.unidad,
            precioCompra: prod.precioCompra,
            precioVentaBase: prod.precioVenta,
            esGranel: prod.esGranel,
            categorias: { connect: [{ id: categoria.id }] },
          },
        });

        // Precio por unidad (necesario para el POS)
        await tx.precioPorUnidad.create({
          data: {
            productoId: producto.id,
            unidad: prod.unidad,
            cantidadMinima: 1,
            precio: prod.precioVenta,
            esDefault: true,
          },
        });

        // Inventario inicial
        await tx.inventarioSucursal.create({
          data: {
            sucursalId: sucursal.id,
            productoId: producto.id,
            stockActual: prod.stock,
            stockMinimo: prod.stockMin,
            stockMaximo: prod.stockMax,
          },
        });

        // Movimiento de auditoría
        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            sucursalId: sucursal.id,
            tipo: TipoMovimientoInventario.apertura_inicial,
            cantidad: prod.stock,
            stockAnterior: 0,
            stockNuevo: prod.stock,
            motivo: 'Inventario inicial de demostración',
            usuarioId: superAdmin.id,
          },
        });
      }

      return { empresa, sucursal, caja, usuario: superAdmin };
    }, { timeout: 30000 });

    return {
      message: 'Ecosistema, catálogo demo y usuarios inicializados correctamente',
      empresaId: result.empresa.id,
    };
  }
}

