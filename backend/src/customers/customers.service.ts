import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreditAccountDto } from './dto/credit-account.dto';
import { PaymentDto } from './dto/payment.dto';
import {
  construirRespuestaPaginada,
  normalizarPaginacion,
} from '../common/helpers/pagination.helper';
import { EstadoCredito, Prisma } from '@prisma/client';

/** Servicio de clientes: CRUD, lealtad y crédito (fiados) multitenant */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listar clientes con búsqueda y paginación estándar */
  async findAll(
    empresaId: string,
    page = 1,
    limit = 20,
    search = '',
    incluirInactivos = false,
  ) {
    const where: Prisma.ClienteWhereInput = { empresaId };
    if (!incluirInactivos) where.estaActivo = true;
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellidoPaterno: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { rfc: { contains: search, mode: 'insensitive' } },
      ];
    }

    const { page: p, limit: l, skip } = normalizarPaginacion(page, limit);

    const [total, data] = await Promise.all([
      this.prisma.cliente.count({ where }),
      this.prisma.cliente.findMany({
        where,
        skip,
        take: l,
        orderBy: [{ nombre: 'asc' }, { apellidoPaterno: 'asc' }],
        include: {
          cuentaCredito: {
            select: { saldoPendiente: true, limiteCredito: true, estaActivo: true },
          },
          nivelLealtad: {
            select: {
              id: true,
              nombre: true,
              colorHex: true,
              descuentoPct: true,
            },
          },
        },
      }),
    ]);

    return construirRespuestaPaginada(data, total, p, l);
  }

  /** Detalle de cliente con puntos, historial de compras paginado y saldo de crédito */
  async findOne(
    empresaId: string,
    id: string,
    ventasPage = 1,
    ventasLimit = 5,
  ) {
    const skipVentas = (Math.max(1, ventasPage) - 1) * ventasLimit;
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId },
      include: {
        nivelLealtad: {
          select: { id: true, nombre: true, colorHex: true, descuentoPct: true },
        },
        cuentaCredito: {
          include: {
            ventasCredito: {
              orderBy: { fechaVencimiento: 'asc' },
            },
          },
        },
        _count: { select: { ventas: true } },
        ventas: {
          skip: skipVentas,
          take: ventasLimit,
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            folio: true,
            total: true,
            estado: true,
            creadoEn: true,
            _count: { select: { detalles: true } },
          },
        },
      },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return cliente;
  }

  /** Crear cliente */
  async create(empresaId: string, dto: CreateCustomerDto) {
    return this.prisma.cliente.create({
      data: { empresaId, ...dto },
    });
  }

  /** Actualizar datos del cliente */
  async update(empresaId: string, id: string, dto: UpdateCustomerDto) {
    await this.assertExists(empresaId, id);
    return this.prisma.cliente.update({
      where: { id },
      data: dto,
    });
  }

  /** Soft delete de cliente */
  async remove(empresaId: string, id: string) {
    await this.assertExists(empresaId, id);
    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.update({
        where: { id },
        data: { estaActivo: false },
      });
      await tx.cuentaCreditoCliente.updateMany({
        where: { clienteId: id },
        data: { estaActivo: false },
      });
      return cliente;
    });
  }

  /** Abrir cuenta de crédito con límite */
  async openCreditAccount(empresaId: string, clienteId: string, dto: CreditAccountDto) {
    await this.assertExists(empresaId, clienteId, true);

    const existente = await this.prisma.cuentaCreditoCliente.findUnique({
      where: { clienteId },
    });
    if (existente && existente.estaActivo) {
      throw new ConflictException('El cliente ya tiene una cuenta de crédito activa');
    }
    if (existente) {
      return this.prisma.cuentaCreditoCliente.update({
        where: { clienteId },
        data: {
          limiteCredito: dto.limiteCredito,
          diasMaximoVencimiento: dto.diasMaximoVencimiento ?? 30,
          estaActivo: true,
        },
      });
    }

    return this.prisma.cuentaCreditoCliente.create({
      data: {
        clienteId,
        limiteCredito: dto.limiteCredito,
        diasMaximoVencimiento: dto.diasMaximoVencimiento ?? 30,
      },
    });
  }

  /**
   * Registrar abono a la deuda del cliente.
   * Los abonos se aplican en orden FIFO: primero la VentaCredito más antigua
   * (por fechaVencimiento). Al liquidar una venta se marca como 'liquidada'.
   */
  async registrarAbono(
    empresaId: string,
    clienteId: string,
    dto: PaymentDto,
    usuarioId: string,
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId },
      include: { cuentaCredito: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    if (!cliente.cuentaCredito || !cliente.cuentaCredito.estaActivo) {
      throw new BadRequestException('El cliente no tiene una cuenta de crédito activa');
    }

    const cuenta = cliente.cuentaCredito;
    if (dto.monto > cuenta.saldoPendiente + 0.001) {
      throw new BadRequestException(
        `El abono ($${dto.monto.toFixed(2)}) excede el saldo pendiente ($${cuenta.saldoPendiente.toFixed(2)})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const ventasPendientes = await tx.ventaCredito.findMany({
        where: {
          clienteId,
          estado: { in: [EstadoCredito.pendiente, EstadoCredito.parcialmente_pagada] },
        },
        orderBy: { fechaVencimiento: 'asc' },
      });

      let restante = dto.monto;
      const abonosAplicados: {
        ventaCreditoId: string;
        folioVenta: string;
        montoAplicado: number;
      }[] = [];

      for (const vc of ventasPendientes) {
        if (restante <= 0) break;

        const aplicado = Math.min(restante, vc.saldoPendiente);
        const nuevoMontoPagado = vc.montoPagado + aplicado;
        const nuevoSaldo = Number((vc.saldoPendiente - aplicado).toFixed(2));
        const liquidada = nuevoSaldo <= 0.001;

        await tx.ventaCredito.update({
          where: { id: vc.id },
          data: {
            montoPagado: nuevoMontoPagado,
            saldoPendiente: nuevoSaldo,
            estado: liquidada ? EstadoCredito.liquidada : EstadoCredito.parcialmente_pagada,
            fechaLiquidacion: liquidada ? new Date() : null,
          },
        });

        await tx.abonoCredito.create({
          data: {
            ventaCreditoId: vc.id,
            monto: aplicado,
            metodoPago: dto.metodoPago,
            referencia: dto.referencia || null,
            notas: dto.notas || null,
            usuarioId,
          },
        });

        abonosAplicados.push({
          ventaCreditoId: vc.id,
          folioVenta: vc.ventaId,
          montoAplicado: aplicado,
        });
        restante -= aplicado;
      }

      const aplicadoTotal = dto.monto - Math.max(restante, 0);
      const cuentaActualizada = await tx.cuentaCreditoCliente.update({
        where: { clienteId },
        data: { saldoPendiente: { decrement: aplicadoTotal } },
      });

      return {
        abonosAplicados,
        saldoPendiente: cuentaActualizada.saldoPendiente,
        limiteCredito: cuentaActualizada.limiteCredito,
      };
    });
  }

  /** Estado de cuenta del cliente (crédito) */
  async estadoDeCuenta(empresaId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId },
      include: {
        cuentaCredito: {
          include: {
            ventasCredito: {
              orderBy: { fechaVencimiento: 'asc' },
              include: {
                venta: { select: { folio: true, creadoEn: true, total: true } },
                abonos: {
                  orderBy: { fechaHora: 'asc' },
                  include: { usuario: { select: { id: true, nombre: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    if (!cliente.cuentaCredito) {
      throw new BadRequestException('El cliente no tiene cuenta de crédito');
    }

    const cuenta = cliente.cuentaCredito;
    const hoy = new Date();
    const resumen = {
      limiteCredito: cuenta.limiteCredito,
      saldoPendiente: cuenta.saldoPendiente,
      saldoDisponible: cuenta.limiteCredito - cuenta.saldoPendiente,
      ventasPendientes: cuenta.ventasCredito.filter(
        (vc) => vc.estado !== EstadoCredito.liquidada,
      ).length,
      ventasVencidas: cuenta.ventasCredito.filter(
        (vc) =>
          vc.estado !== EstadoCredito.liquidada && vc.fechaVencimiento < hoy,
      ).length,
    };

    return { cliente: { ...cliente, cuentaCredito: undefined }, cuenta, resumen };
  }

  /**
   * D11: Historial de movimientos de puntos del cliente (auditoría).
   * Incluye ganados, canjeados y expirados, con la venta de origen si aplica.
   */
  async historialMovimientosPuntos(empresaId: string, clienteId: string) {
    await this.assertExists(empresaId, clienteId);

    const movimientos = await this.prisma.movimientoPuntos.findMany({
      where: { clienteId },
      orderBy: { creadoEn: 'desc' },
      take: 200,
      select: {
        id: true,
        tipo: true,
        puntos: true,
        expiraEn: true,
        puntosConsumidos: true,
        creadoEn: true,
        ventaId: true,
      },
    });

    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { puntosActuales: true, puntosHistoricos: true },
    });

    return { ...cliente, movimientos };
  }

  private async assertExists(empresaId: string, id: string, activo = false) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId, ...(activo ? { estaActivo: true } : {}) },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }
}
