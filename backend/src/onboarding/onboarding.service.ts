import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
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

    // Cifrar la contraseña
    const passwordHash = await argon2.hash(dto.adminPass);

    // Datos reales de abarrotes (México)
    const demoProducts = [
      { codigoBarras: '7501055300075', nombre: 'Coca-Cola Original 600ml PET', precioCompra: 12.0, precioVenta: 18.0, stock: 150 },
      { codigoBarras: '7501011115668', nombre: 'Papas Sabritas Original 42g', precioCompra: 11.5, precioVenta: 17.0, stock: 80 },
      { codigoBarras: '7501030460985', nombre: 'Pastelito Gansito Marinela 50g', precioCompra: 10.0, precioVenta: 15.0, stock: 50 },
      { codigoBarras: '7501020512809', nombre: 'Leche Lala Entera 1 Litro', precioCompra: 22.0, precioVenta: 28.0, stock: 120 },
      { codigoBarras: '7501045402437', nombre: 'Atún Dolores en Agua 140g', precioCompra: 16.5, precioVenta: 22.0, stock: 200 }
    ];

    // Ejecutar Transacción Atómica
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear Empresa
      const empresa = await tx.empresa.create({
        data: { nombre: dto.businessName },
      });

      // 2. Crear Sucursal vinculada a la Empresa
      const sucursal = await tx.sucursal.create({
        data: {
          nombre: dto.branchName,
          empresaId: empresa.id,
        },
      });

      // 3. Crear Caja Principal vinculada a la Sucursal
      const caja = await tx.caja.create({
        data: {
          nombre: dto.registerId,
          sucursalId: sucursal.id,
        },
      });

      // 4. Crear Usuario Super Admin vinculado a la Empresa
      const usuario = await tx.usuario.create({
        data: {
          nombre: 'Administrador', // Nombre por defecto
          email: dto.adminEmail,
          passwordHash,
          rol: 'SUPER_ADMIN',
          empresaId: empresa.id,
        },
      });

      // 5. Generar Catálogo Demo y su Inventario
      for (const prod of demoProducts) {
        // a) Crear Producto
        const producto = await tx.producto.create({
          data: {
            empresaId: empresa.id,
            codigoBarras: prod.codigoBarras,
            codigoInterno: `DEMO-${prod.codigoBarras.substring(prod.codigoBarras.length - 4)}`,
            nombre: prod.nombre,
            descripcion: 'Producto demo autogenerado',
            unidadMedida: 'pieza',
            precioCompra: prod.precioCompra,
            precioVentaBase: prod.precioVenta,
            esGranel: false,
          }
        });

        // b) Crear Precio por Unidad (Obligatorio en nuestra arquitectura para poder vender)
        await tx.precioPorUnidad.create({
          data: {
            productoId: producto.id,
            unidad: 'pieza',
            cantidadMinima: 1,
            precio: prod.precioVenta,
            esDefault: true
          }
        });

        // c) Crear el registro en el Inventario de esta Sucursal
        await tx.inventarioSucursal.create({
          data: {
            sucursalId: sucursal.id,
            productoId: producto.id,
            stockActual: prod.stock,
            stockMinimo: 10,
            stockMaximo: 500
          }
        });

        // d) Dejar rastro en auditoría de Movimientos de Inventario
        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            sucursalId: sucursal.id,
            tipo: 'apertura_inicial',
            cantidad: prod.stock,
            stockAnterior: 0,
            stockNuevo: prod.stock,
            motivo: 'Inventario inicial de demostración',
            usuarioId: usuario.id
          }
        });
      }

      return { empresa, sucursal, caja, usuario };
    });

    return {
      message: 'Ecosistema y catálogo demo inicializados correctamente',
      empresaId: result.empresa.id,
    };
  }
}
