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
          nombre: 'Administrador', // Nombre por defecto, el usuario puede cambiarlo en configuración
          email: dto.adminEmail,
          passwordHash,
          rol: 'SUPER_ADMIN',
          empresaId: empresa.id,
        },
      });

      return { empresa, sucursal, caja, usuario };
    });

    return {
      message: 'Ecosistema inicializado correctamente',
      empresaId: result.empresa.id,
    };
  }
}
