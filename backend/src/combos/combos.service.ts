import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoPrecioCombo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import {
  construirRespuestaPaginada,
  normalizarPaginacion,
} from '../common/helpers/pagination.helper';

/** Descuento máximo (%) permitido para un combo de tipo DESCUENTO_PCT */
const PCT_MAX_DESCUENTO_COMBO = 90;

const comboProductoInclude = {
  producto: {
    select: {
      id: true,
      nombre: true,
      precioVentaBase: true,
    },
  },
} satisfies Prisma.ComboProductoInclude;

const redondear2 = (n: number) => Math.round(n * 100) / 100;

export interface ResumenCombo {
  precioOriginal: number; // suma de precios individuales (antes de descuento)
  precioCombo: number; // precio efectivo del paquete
  ahorro: number; // dinero que ahorra el cliente
}

@Injectable()
export class CombosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Listar combos de la empresa con paginación y filtros */
  async findAll(
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    incluirInactivos = false,
    soloVigentes = false,
  ) {
    const where: Prisma.ComboWhereInput = { empresaId };
    if (!incluirInactivos) where.activo = true;

    const condicionesBusqueda: Prisma.ComboWhereInput | undefined = search
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' as const } },
            { descripcion: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    if (soloVigentes) {
      const ahora = new Date();
      where.activo = true;
      where.AND = [
        {
          OR: [{ fechaInicio: null }, { fechaInicio: { lte: ahora } }],
          AND: [{ OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] }],
        },
        ...(search
          ? [
              {
                OR: [
                  { nombre: { contains: search, mode: 'insensitive' as const } },
                  { descripcion: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ];
    } else if (search && condicionesBusqueda) {
      where.OR = condicionesBusqueda.OR;
    }

    const { page: p, limit: l, skip } = normalizarPaginacion(page, limit);

    const [total, data] = await Promise.all([
      this.prisma.combo.count({ where }),
      this.prisma.combo.findMany({
        where,
        skip,
        take: l,
        orderBy: [{ creadoEn: 'desc' }],
        include: {
          productos: {
            include: comboProductoInclude,
            orderBy: { productoId: 'asc' },
          },
        },
      }),
    ]);

    return construirRespuestaPaginada(
      data.map((combo) => ({
        ...combo,
        resumen: this.calcularResumen(combo.productos, combo),
      })),
      total,
      p,
      l,
    );
  }

  /** Detalle de un combo con sus productos */
  async findOne(empresaId: string, id: string) {
    const combo = await this.prisma.combo.findFirst({
      where: { id, empresaId },
      include: {
        productos: { include: comboProductoInclude, orderBy: { productoId: 'asc' } },
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    if (!combo) throw new NotFoundException('Combo no encontrado');

    return {
      ...combo,
      resumen: this.calcularResumen(combo.productos, combo),
    };
  }

  /** Crear un combo con sus productos */
  async create(empresaId: string, creadoPorId: string, dto: CreateComboDto) {
    const { productos = [] } = dto;

    this.validarRangoFechas(dto.fechaInicio, dto.fechaFin);

    const precioOriginal = await this.validarEstructura(
      productos,
      dto.tipoPrecio,
      dto.valorPrecio,
      empresaId,
    );

    const resultado = await this.prisma.$transaction(async (tx) => {
      const combo = await tx.combo.create({
        data: {
          empresaId,
          creadoPorId,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
          tipoPrecio: dto.tipoPrecio,
          valorPrecio: dto.valorPrecio,
          activo: dto.activo ?? true,
          fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
          fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        },
      });

      await tx.comboProducto.createMany({
        data: productos.map((item) => ({
          comboId: combo.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
        })),
      });

      // Releer el combo con sus productos para devolver el resumen de precios
      const comboFinal = await tx.combo.findUnique({
        where: { id: combo.id },
        include: {
          productos: { include: comboProductoInclude, orderBy: { productoId: 'asc' } },
        },
      });
      if (!comboFinal) throw new NotFoundException('Combo no encontrado');

      return {
        combo: {
          ...comboFinal,
          resumen: this.calcularResumen(comboFinal.productos, comboFinal),
        },
        precioOriginal,
      };
    });

    // Auditoría: registrar la creación del combo
    await this.auditService.registrarEvento({
      empresaId,
      usuarioId: creadoPorId,
      accion: 'COMBO_CREADO',
      entidadTipo: 'combo',
      entidadId: resultado.combo.id,
      detalles: {
        nombre: resultado.combo.nombre,
        tipoPrecio: resultado.combo.tipoPrecio,
        valorPrecio: resultado.combo.valorPrecio,
        activo: resultado.combo.activo,
        numeroProductos: productos.length,
        precioOriginal: resultado.combo.resumen.precioOriginal,
        precioCombo: resultado.combo.resumen.precioCombo,
        ahorro: resultado.combo.resumen.ahorro,
      },
      severidad: 'info',
    });

    return resultado;
  }

  /** Actualizar un combo (datos, precio o listado de productos) */
  async update(
    empresaId: string,
    id: string,
    dto: UpdateComboDto,
    usuarioId: string,
  ) {
    const actual = await this.prisma.combo.findFirst({
      where: { id, empresaId },
      include: { productos: true },
    });
    if (!actual) throw new NotFoundException('Combo no encontrado');

    const fechaInicio =
      dto.fechaInicio !== undefined
        ? dto.fechaInicio
          ? new Date(dto.fechaInicio)
          : null
        : actual.fechaInicio;
    const fechaFin =
      dto.fechaFin !== undefined
        ? dto.fechaFin
          ? new Date(dto.fechaFin)
          : null
        : actual.fechaFin;
    if (
      dto.fechaInicio !== undefined ||
      dto.fechaFin !== undefined
    ) {
      this.validarRangoFechas(
        fechaInicio?.toISOString() ?? null,
        fechaFin?.toISOString() ?? null,
      );
    }

    const tipoPrecio = dto.tipoPrecio ?? actual.tipoPrecio;
    const valorPrecio = dto.valorPrecio ?? actual.valorPrecio;
    const productos = dto.productos ?? actual.productos;

    await this.validarEstructura(
      productos,
      tipoPrecio,
      valorPrecio,
      empresaId,
    );


    const resultado = await this.prisma.$transaction(async (tx) => {
      const combo = await tx.combo.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.descripcion !== undefined
            ? { descripcion: dto.descripcion?.trim() || null }
            : {}),
          ...(dto.tipoPrecio !== undefined ? { tipoPrecio: dto.tipoPrecio } : {}),
          ...(dto.valorPrecio !== undefined ? { valorPrecio: dto.valorPrecio } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          ...(dto.fechaInicio !== undefined ? { fechaInicio } : {}),
          ...(dto.fechaFin !== undefined ? { fechaFin } : {}),
        },
        include: { productos: { include: comboProductoInclude } },
      });

      if (dto.productos) {
        await tx.comboProducto.deleteMany({ where: { comboId: id } });
        await tx.comboProducto.createMany({
          data: dto.productos.map((item) => ({
            comboId: id,
            productoId: item.productoId,
            cantidad: item.cantidad,
          })),
        });
      }

      return combo;
    });

    // Auditoría: registrar la actualización del combo
    await this.auditService.registrarEvento({
      empresaId,
      usuarioId,
      accion: 'COMBO_ACTUALIZADO',
      entidadTipo: 'combo',
      entidadId: resultado.id,
      detalles: {
        nombre: resultado.nombre,
        tipoPrecio: resultado.tipoPrecio,
        valorPrecio: resultado.valorPrecio,
        activo: resultado.activo,
        cambiaProductos: dto.productos !== undefined,
      },
      severidad: 'info',
    });

    return resultado;
  }

  /** Eliminación lógica de combo (desactivar) */
  async remove(empresaId: string, id: string, usuarioId: string) {
    const actual = await this.prisma.combo.findFirst({
      where: { id, empresaId },
    });
    if (!actual) throw new NotFoundException('Combo no encontrado');

    const resultado = await this.prisma.combo.update({
      where: { id },
      data: { activo: false },
    });

    // Auditoría: registrar la desactivación del combo
    await this.auditService.registrarEvento({
      empresaId,
      usuarioId,
      accion: 'COMBO_DESACTIVADO',
      entidadTipo: 'combo',
      entidadId: resultado.id,
      detalles: {
        nombre: resultado.nombre,
        tipoPrecio: resultado.tipoPrecio,
        valorPrecio: resultado.valorPrecio,
      },
      severidad: 'warning',
    });

    return resultado;
  }

  /**
   * Calcular el resumen de precios de un combo (para tarjetas del POS y admin).
   * Precios siempre derivados de `precioVentaBase` actual de cada producto.
   */
  calcularResumen(
    productos: { cantidad: number; producto?: { precioVentaBase: number } }[],
    combo: { tipoPrecio: TipoPrecioCombo; valorPrecio: number },
  ): ResumenCombo {
    const precioOriginal = redondear2(
      productos.reduce(
        (acc, p) => acc + (p.producto?.precioVentaBase ?? 0) * p.cantidad,
        0,
      ),
    );

    const precioCombo =
      combo.tipoPrecio === TipoPrecioCombo.MONTO_FIJO
        ? redondear2(Math.min(combo.valorPrecio, precioOriginal || Infinity))
        : redondear2(precioOriginal * (1 - combo.valorPrecio / 100));

    const ahorro = redondear2(Math.max(precioOriginal - precioCombo, 0));

    return { precioOriginal, precioCombo, ahorro };
  }

  /**
   * Validar que la estructura del combo sea válida:
   * - al menos un producto con cantidad > 0
   * - sin productos duplicados
   * - todos los productos existen y están activos en la empresa
   * - el precio genera un ahorro real (será validado por el usuario final)
   * Devuelve la suma de precios individuales (precioOriginal).
   */
  private async validarEstructura(
    productos: { productoId: string; cantidad: number }[],
    tipoPrecio: TipoPrecioCombo,
    valorPrecio: number,
    empresaId: string,
  ): Promise<number> {
    if (productos.length === 0) {
      throw new BadRequestException(
        'El combo debe incluir al menos un producto',
      );
    }

    const ids = productos.map((p) => p.productoId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Un producto no puede repetirse dentro del mismo combo',
      );
    }

    for (const item of productos) {
      if (!item.cantidad || item.cantidad <= 0) {
        throw new BadRequestException(
          'La cantidad de cada producto debe ser mayor a cero',
        );
      }
    }

    const encontrados = await this.prisma.producto.findMany({
      where: { id: { in: ids }, empresaId },
      select: { id: true, precioVentaBase: true, estaActivo: true },
    });
    const mapa = new Map(encontrados.map((p) => [p.id, p]));

    for (const item of productos) {
      const producto = mapa.get(item.productoId);
      if (!producto) {
        throw new BadRequestException(
          'Uno o más productos del combo no fueron encontrados',
        );
      }
      if (!producto.estaActivo) {
        throw new BadRequestException(
          `El producto está inactivo y no puede participar en un combo`,
        );
      }
    }

    const precioOriginal = redondear2(
      productos.reduce(
        (acc, item) =>
          acc + (mapa.get(item.productoId)?.precioVentaBase ?? 0) * item.cantidad,
        0,
      ),
    );

    if (tipoPrecio === TipoPrecioCombo.MONTO_FIJO) {
      if (valorPrecio <= 0) {
        throw new BadRequestException(
          'El precio del combo debe ser mayor a cero',
        );
      }
      if (valorPrecio >= precioOriginal) {
        throw new BadRequestException(
          `El precio del combo ($${valorPrecio.toFixed(2)}) debe ser menor a la suma de sus productos ($${precioOriginal.toFixed(2)}) para generar un ahorro real`,
        );
      }
    } else if (tipoPrecio === TipoPrecioCombo.DESCUENTO_PCT) {
      if (valorPrecio <= 0 || valorPrecio > PCT_MAX_DESCUENTO_COMBO) {
        throw new BadRequestException(
          `El porcentaje de descuento del combo debe estar entre 1 y ${PCT_MAX_DESCUENTO_COMBO}`,
        );
      }
    }

    return precioOriginal;
  }

  private validarRangoFechas(
    fechaInicio?: string | null,
    fechaFin?: string | null,
  ) {
    if (fechaInicio && fechaFin && new Date(fechaFin) < new Date(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
  }
}