import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NivelLealtadDto, UpdateSettingsDto } from './dto/update-settings.dto';
import { resolverNivel } from '../customers/loyalty.util';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la configuración general de la Empresa junto con el Programa de Lealtad (D10).
   * @param empresaId Identificador de la empresa del usuario autenticado.
   * @returns Objeto con la configuración actual de la empresa y su programa de lealtad.
   */
  async getSettings(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        nombre: true,
        modoCorteZ: true,
        umbralFaltanteCritico: true,
        stockMinimoGlobal: true,
        stockMaximoGlobal: true,
        programaLealtad: {
          include: {
            niveles: { orderBy: { umbralPuntos: 'asc' } },
          },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return empresa;
  }

  /**
   * D10: Obtiene únicamente la configuración del Programa de Lealtad.
   * Pensado para roles operativos (CAJERO/GERENTE) que necesitan leer los
   * descuentos y reglas en el punto de venta sin acceso a la configuración completa.
   * Si la empresa aún no tiene configuración, se crea con los valores por defecto.
   */
  async getProgramaLealtad(empresaId: string) {
    return this.obtenerOCrearPrograma(empresaId);
  }

  /**
   * Obtiene el programa de lealtad de la empresa y lo crea con valores por defecto si no existe.
   */
  private async obtenerOCrearPrograma(empresaId: string) {
    const existente = await this.prisma.programaLealtad.findUnique({
      where: { empresaId },
      include: { niveles: { orderBy: { umbralPuntos: 'asc' } } },
    });
    if (existente) return existente;

    return this.prisma.programaLealtad.create({
      data: { empresaId },
      include: { niveles: { orderBy: { umbralPuntos: 'asc' } } },
    });
  }

  /**
   * Actualiza la configuración general de la Empresa y/o el Programa de Lealtad (D10).
   * Si un campo no se envía, se conserva el valor existente.
   * @param empresaId Identificador de la empresa del usuario autenticado.
   * @param dto Campos de configuración a actualizar.
   * @returns Objeto con la configuración actualizada.
   */
  async updateSettings(empresaId: string, dto: UpdateSettingsDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // D10: Aplicar cambios del programa de lealtad si vienen informados
    if (dto.programaLealtad) {
      await this.actualizarProgramaLealtad(empresaId, dto.programaLealtad);
    }

    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        ...(dto.modoCorteZ !== undefined ? { modoCorteZ: dto.modoCorteZ } : {}),
        ...(dto.umbralFaltanteCritico !== undefined
          ? { umbralFaltanteCritico: dto.umbralFaltanteCritico }
          : {}),
        ...(dto.stockMinimoGlobal !== undefined
          ? { stockMinimoGlobal: dto.stockMinimoGlobal }
          : {}),
        ...(dto.stockMaximoGlobal !== undefined
          ? { stockMaximoGlobal: dto.stockMaximoGlobal }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        modoCorteZ: true,
        umbralFaltanteCritico: true,
        stockMinimoGlobal: true,
        stockMaximoGlobal: true,
        programaLealtad: {
          include: { niveles: { orderBy: { umbralPuntos: 'asc' } } },
        },
      },
    });
  }

  /**
   * D10: Actualiza la configuración del Programa de Lealtad de forma atómica.
   * - Crea la configuración con valores por defecto si la empresa aún no la tiene.
   * - Reconcilia los niveles: actualiza por `id`, crea los nuevos y elimina los ausentes.
   * - Recalcula el nivel asignado a cada cliente según los umbrales vigentes.
   */
  private async actualizarProgramaLealtad(
    empresaId: string,
    dto: import('./dto/update-settings.dto').ProgramaLealtadDto,
  ) {
    const programa = await this.obtenerOCrearPrograma(empresaId);

    // Validar umbrales de niveles: únicos y estrictamente ascendentes
    if (dto.niveles) {
      const ordenados = [...dto.niveles].sort(
        (a, b) => a.umbralPuntos - b.umbralPuntos,
      );
      for (let i = 1; i < ordenados.length; i++) {
        if (ordenados[i].umbralPuntos === ordenados[i - 1].umbralPuntos) {
          throw new BadRequestException(
            `El umbral de puntos ${ordenados[i].umbralPuntos} está duplicado en dos o más niveles`,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar campos escalares del programa
      await tx.programaLealtad.update({
        where: { id: programa.id },
        data: {
          ...(dto.habilitado !== undefined ? { habilitado: dto.habilitado } : {}),
          ...(dto.puntosPorMonto !== undefined
            ? { puntosPorMonto: dto.puntosPorMonto }
            : {}),
          ...(dto.montoMinimoParaPuntos !== undefined
            ? { montoMinimoParaPuntos: dto.montoMinimoParaPuntos }
            : {}),
          ...(dto.basePuntos !== undefined ? { basePuntos: dto.basePuntos } : {}),
          ...(dto.permitirCanje !== undefined
            ? { permitirCanje: dto.permitirCanje }
            : {}),
          ...(dto.puntosPorPesos !== undefined
            ? { puntosPorPesos: dto.puntosPorPesos }
            : {}),
          ...(dto.canjeMinimoPuntos !== undefined
            ? { canjeMinimoPuntos: dto.canjeMinimoPuntos }
            : {}),
          ...(dto.mesesExpiracionPuntos !== undefined
            ? { mesesExpiracionPuntos: dto.mesesExpiracionPuntos }
            : {}),
        },
      });

      // 2. Reconciliar niveles (actualizar / crear / eliminar)
      if (dto.niveles) {
        const actuales = await tx.nivelLealtad.findMany({
          where: { programaId: programa.id },
          select: { id: true },
        });
        const idsActuales = actuales.map((n) => n.id);
        const idsEntrantes = new Set(
          dto.niveles.filter((n) => n.id).map((n) => n.id as string),
        );

        // Validar que los ids entrantes pertenezcan al programa de esta empresa
        for (const idEntrante of idsEntrantes) {
          if (!idsActuales.includes(idEntrante)) {
            throw new BadRequestException(
              `El nivel con id ${idEntrante} no pertenece al programa de esta empresa`,
            );
          }
        }

        // Eliminar los niveles ausentes en la petición (los clientes quedan sin nivel vía SET NULL)
        const aEliminar = idsActuales.filter((id) => !idsEntrantes.has(id));
        if (aEliminar.length > 0) {
          await tx.nivelLealtad.deleteMany({
            where: { id: { in: aEliminar } },
          });
        }

        // Actualizar existentes y crear nuevos
        for (const nivel of dto.niveles) {
          const data = {
            nombre: nivel.nombre.trim(),
            umbralPuntos: nivel.umbralPuntos,
            descuentoPct: nivel.descuentoPct,
            colorHex: nivel.colorHex ?? null,
          };
          if (nivel.id && idsActuales.includes(nivel.id)) {
            await tx.nivelLealtad.update({
              where: { id: nivel.id },
              data,
            });
          } else {
            await tx.nivelLealtad.create({
              data: { ...data, programaId: programa.id },
            });
          }
        }
      }

      // 3. Recalcular el nivel de cada cliente de la empresa según los umbrales vigentes
      const clientes = await tx.cliente.findMany({
        where: { empresaId },
        select: { id: true, puntosHistoricos: true, nivelLealtadId: true },
      });
      const nivelesVigentes = await tx.nivelLealtad.findMany({
        where: { programaId: programa.id },
        select: { id: true, nombre: true, umbralPuntos: true, descuentoPct: true },
      });

      for (const cliente of clientes) {
        const nivel = resolverNivel(cliente.puntosHistoricos, nivelesVigentes);
        const nuevoNivelId = nivel?.id ?? null;
        if (nuevoNivelId !== cliente.nivelLealtadId) {
          await tx.cliente.update({
            where: { id: cliente.id },
            data: { nivelLealtadId: nuevoNivelId },
          });
        }
      }
    });
  }
}
