import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la configuración general de la Empresa.
   * @param empresaId Identificador de la empresa del usuario autenticado.
   * @returns Objeto con la configuración actual de la empresa.
   */
  async getSettings(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        nombre: true,
        modoCorteZ: true,
        umbralFaltanteCritico: true,
      },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return empresa;
  }

  /**
   * Actualiza la configuración general de la Empresa.
   * Si el campo no se envía, se conserva el valor existente.
   * @param empresaId Identificador de la empresa del usuario autenticado.
   * @param dto Campos de configuración a actualizar.
   * @returns Objeto con la configuración actualizada de la empresa.
   */
  async updateSettings(empresaId: string, dto: UpdateSettingsDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        ...(dto.modoCorteZ !== undefined ? { modoCorteZ: dto.modoCorteZ } : {}),
        ...(dto.umbralFaltanteCritico !== undefined
          ? { umbralFaltanteCritico: dto.umbralFaltanteCritico }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        modoCorteZ: true,
        umbralFaltanteCritico: true,
      },
    });
  }
}
