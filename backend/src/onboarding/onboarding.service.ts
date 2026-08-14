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
      throw new ForbiddenException(
        'El sistema ya cuenta con una empresa registrada. Por seguridad, el onboarding está deshabilitado.',
      );
    }

    // Cifrar la contraseña del superadmin
    const passwordSuperAdmin = await argon2.hash(dto.adminPass);

    // Ejecutar Transacción Atómica
    const result = await this.prisma.$transaction(
      async (tx) => {
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

        return { empresa, sucursal, caja, usuario: superAdmin };
      },
      { timeout: 30000 },
    );

    return {
      message: 'Ecosistema inicializado correctamente',
      empresaId: result.empresa.id,
    };
  }
}
