import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ModoCorteZ } from '@prisma/client';
import { CompanySettingsService } from './company-settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CompanySettingsService', () => {
  let service: CompanySettingsService;
  let prisma: {
    empresa: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const empresaId = 'empresa-1';

  beforeEach(async () => {
    prisma = {
      empresa: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySettingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CompanySettingsService>(CompanySettingsService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('debe retornar la configuración de la empresa', async () => {
      const empresa = {
        id: empresaId,
        nombre: 'Mi Tienda',
        modoCorteZ: ModoCorteZ.abierto,
        umbralFaltanteCritico: 75,
      };
      prisma.empresa.findUnique.mockResolvedValue(empresa);

      await expect(service.getSettings(empresaId)).resolves.toEqual(empresa);

      expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
        where: { id: empresaId },
        select: {
          id: true,
          nombre: true,
          modoCorteZ: true,
          umbralFaltanteCritico: true,
        },
      });
    });

    it('debe lanzar NotFoundException si la empresa no existe', async () => {
      prisma.empresa.findUnique.mockResolvedValue(null);

      await expect(service.getSettings(empresaId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSettings', () => {
    it('debe actualizar el modoCorteZ de la empresa', async () => {
      prisma.empresa.findUnique.mockResolvedValue({ id: empresaId });
      prisma.empresa.update.mockResolvedValue({
        id: empresaId,
        nombre: 'Mi Tienda',
        modoCorteZ: ModoCorteZ.abierto,
        umbralFaltanteCritico: 75,
      });

      const result = await service.updateSettings(empresaId, {
        modoCorteZ: ModoCorteZ.abierto,
        umbralFaltanteCritico: 75,
      });

      expect(prisma.empresa.update).toHaveBeenCalledWith({
        where: { id: empresaId },
        data: {
          modoCorteZ: ModoCorteZ.abierto,
          umbralFaltanteCritico: 75,
        },
        select: {
          id: true,
          nombre: true,
          modoCorteZ: true,
          umbralFaltanteCritico: true,
        },
      });
      expect(result.modoCorteZ).toBe(ModoCorteZ.abierto);
      expect(result.umbralFaltanteCritico).toBe(75);
    });

    it('debe lanzar NotFoundException si la empresa no existe', async () => {
      prisma.empresa.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSettings(empresaId, { modoCorteZ: ModoCorteZ.ciego }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
