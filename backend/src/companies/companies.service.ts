import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Servicio de empresas: consultas sobre la empresa del usuario autenticado */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sucursales activas de la empresa */
  async listarSucursales(empresaId: string) {
    return this.prisma.sucursal.findMany({
      where: { empresaId },
      select: { id: true, nombre: true, estaActivo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
