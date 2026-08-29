import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Prisma, TipoDescuentoCupon } from '@prisma/client';
import {
  construirRespuestaPaginada,
  normalizarPaginacion,
} from '../common/helpers/pagination.helper';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listar cupones de la empresa con paginación y filtros */
  async findAll(
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    incluirInactivos = false,
  ) {
    const where: Prisma.CuponWhereInput = { empresaId };
    if (!incluirInactivos) where.activo = true;
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
      ];
    }

    const { page: p, limit: l, skip } = normalizarPaginacion(page, limit);

    const [total, data] = await Promise.all([
      this.prisma.cupon.count({ where }),
      this.prisma.cupon.findMany({
        where,
        skip,
        take: l,
        orderBy: [{ creadoEn: 'desc' }],
        include: {
          _count: {
            select: { redenciones: true },
          },
        },
      }),
    ]);

    return construirRespuestaPaginada(data, total, p, l);
  }

  /** Detalle de un cupón con sus redenciones */
  async findOne(empresaId: string, id: string) {
    const cupon = await this.prisma.cupon.findFirst({
      where: { id, empresaId },
      include: {
        _count: { select: { redenciones: true } },
        redenciones: {
          orderBy: { creadoEn: 'desc' },
          take: 50,
          include: {
            venta: { select: { id: true, folio: true, total: true, creadoEn: true } },
          },
        },
      },
    });
    if (!cupon) throw new NotFoundException('Cupón no encontrado');
    return cupon;
  }

  /** Crear cupón */
  async create(empresaId: string, dto: CreateCouponDto) {
    const codigo = dto.codigo.trim().toUpperCase();

    const existente = await this.prisma.cupon.findFirst({
      where: { empresaId, codigo },
    });
    if (existente) {
      throw new ConflictException('Ya existe un cupón con ese código');
    }

    this.validarRangoFechas(dto.fechaInicio, dto.fechaFin);
    this.validarTipoDescuento(dto.tipoDescuento, dto.valorDescuento);

    return this.prisma.cupon.create({
      data: {
        empresaId,
        codigo,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        tipoDescuento: dto.tipoDescuento,
        valorDescuento: dto.valorDescuento,
        montoMinimoCompra: dto.montoMinimoCompra ?? null,
        soloClientesRegistrados: dto.soloClientesRegistrados ?? false,
        limiteUsosTotal: dto.limiteUsosTotal ?? null,
        limiteUsosPorCliente: dto.limiteUsosPorCliente ?? null,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        activo: dto.activo ?? true,
      },
    });
  }

  /** Actualizar cupón */
  async update(empresaId: string, id: string, dto: UpdateCouponDto) {
    const cupon = await this.prisma.cupon.findFirst({ where: { id, empresaId } });
    if (!cupon) throw new NotFoundException('Cupón no encontrado');

    const fechaInicio =
      dto.fechaInicio !== undefined ? new Date(dto.fechaInicio) : cupon.fechaInicio;
    const fechaFin =
      dto.fechaFin !== undefined
        ? dto.fechaFin
          ? new Date(dto.fechaFin)
          : null
        : cupon.fechaFin;

    if (dto.fechaInicio !== undefined || dto.fechaFin !== undefined) {
      this.validarRangoFechas(fechaInicio.toISOString(), fechaFin?.toISOString());
    }

    const tipoDescuento =
      dto.tipoDescuento ?? cupon.tipoDescuento;
    const valorDescuento = dto.valorDescuento ?? cupon.valorDescuento;
    this.validarTipoDescuento(tipoDescuento, valorDescuento);

    let codigo = cupon.codigo;
    if (dto.codigo) {
      codigo = dto.codigo.trim().toUpperCase();
      const existente = await this.prisma.cupon.findFirst({
        where: { empresaId, codigo, id: { not: id } },
      });
      if (existente) {
        throw new ConflictException('Ya existe un cupón con ese código');
      }
    }

    return this.prisma.cupon.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined ? { codigo } : {}),
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion?.trim() || null } : {}),
        ...(dto.tipoDescuento !== undefined ? { tipoDescuento: dto.tipoDescuento } : {}),
        ...(dto.valorDescuento !== undefined ? { valorDescuento: dto.valorDescuento } : {}),
        ...(dto.montoMinimoCompra !== undefined
          ? { montoMinimoCompra: dto.montoMinimoCompra ?? null }
          : {}),
        ...(dto.soloClientesRegistrados !== undefined
          ? { soloClientesRegistrados: dto.soloClientesRegistrados }
          : {}),
        ...(dto.limiteUsosTotal !== undefined
          ? { limiteUsosTotal: dto.limiteUsosTotal ?? null }
          : {}),
        ...(dto.limiteUsosPorCliente !== undefined
          ? { limiteUsosPorCliente: dto.limiteUsosPorCliente ?? null }
          : {}),
        ...(dto.fechaInicio !== undefined ? { fechaInicio } : {}),
        ...(dto.fechaFin !== undefined ? { fechaFin } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  /** Soft delete de cupón (desactivar) */
  async remove(empresaId: string, id: string) {
    const cupon = await this.prisma.cupon.findFirst({ where: { id, empresaId } });
    if (!cupon) throw new NotFoundException('Cupón no encontrado');

    return this.prisma.cupon.update({
      where: { id },
      data: { activo: false },
    });
  }

  /**
   * Validar un cupón por código sin redimirlo.
   * Devuelve la información del cupón aplicable y el monto de descuento estimado.
   */
  async validar(
    empresaId: string,
    codigo: string,
    opts: { clienteId?: string; subtotalBase?: number } = {},
  ) {
    const codigoNorm = codigo.trim().toUpperCase();

    const cupon = await this.prisma.cupon.findFirst({
      where: { empresaId, codigo: codigoNorm },
      include: {
        _count: { select: { redenciones: true } },
      },
    });
    if (!cupon) {
      throw new NotFoundException('Cupón no encontrado');
    }

    this.asegurarVigente(cupon);
    this.asegurarActivo(cupon);

    // Requisito de cliente registrado
    if (cupon.soloClientesRegistrados && !opts.clienteId) {
      throw new BadRequestException(
        'Este cupón solo aplica para clientes registrados',
      );
    }

    // Monto mínimo de compra (base = subtotal antes de descuentos por nivel/canje)
    const base = opts.subtotalBase ?? 0;
    if (cupon.montoMinimoCompra && base < cupon.montoMinimoCompra) {
      throw new BadRequestException(
        `Este cupón requiere una compra mínima de $${cupon.montoMinimoCompra.toFixed(2)}`,
      );
    }

    // Límite total de usos
    if (
      cupon.limiteUsosTotal !== null &&
      cupon._count.redenciones >= cupon.limiteUsosTotal
    ) {
      throw new BadRequestException(
        'Este cupón ya alcanzó su límite de usos disponibles',
      );
    }

    // Límite por cliente
    if (cupon.limiteUsosPorCliente && opts.clienteId) {
      const usosCliente = await this.prisma.cuponRedencion.count({
        where: { cuponId: cupon.id, clienteId: opts.clienteId },
      });
      if (usosCliente >= cupon.limiteUsosPorCliente) {
        throw new BadRequestException(
          'Este cliente ya alcanzó el límite de usos de este cupón',
        );
      }
    }

    return cupon;
  }

  /** Validar y calcular el monto de descuento exacto de un cupón para una venta */
  async calcularDescuento(
    cupon: {
      tipoDescuento: TipoDescuentoCupon;
      valorDescuento: number;
    },
    base: number,
  ) {
    if (cupon.tipoDescuento === TipoDescuentoCupon.MONTO_FIJO) {
      return Math.round(Math.min(cupon.valorDescuento, base) * 100) / 100;
    }
    // PORCENTAJE (0-100)
    const pct = Math.min(Math.max(cupon.valorDescuento, 0), 100) / 100;
    return Math.round(base * pct * 100) / 100;
  }

  private asegurarActivo(cupon: { activo: boolean }) {
    if (!cupon.activo) {
      throw new BadRequestException('El cupón está desactivado');
    }
  }

  private asegurarVigente(cupon: { fechaInicio: Date; fechaFin: Date | null }) {
    const ahora = new Date();
    if (ahora < cupon.fechaInicio) {
      throw new BadRequestException(
        'El cupón aún no está vigente',
      );
    }
    if (cupon.fechaFin && ahora > cupon.fechaFin) {
      throw new BadRequestException('El cupón ha caducado');
    }
  }

  private validarTipoDescuento(
    tipoDescuento: TipoDescuentoCupon,
    valorDescuento: number,
  ) {
    if (tipoDescuento === TipoDescuentoCupon.PORCENTAJE) {
      if (valorDescuento <= 0 || valorDescuento > 100) {
        throw new BadRequestException(
          'El porcentaje de descuento debe estar entre 0 y 100',
        );
      }
    } else if (tipoDescuento === TipoDescuentoCupon.MONTO_FIJO) {
      if (valorDescuento <= 0) {
        throw new BadRequestException(
          'El monto de descuento debe ser mayor a cero',
        );
      }
    }
  }

  private validarRangoFechas(
    fechaInicio: string,
    fechaFin?: string,
  ) {
    if (fechaFin && new Date(fechaFin) < new Date(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
  }
}
