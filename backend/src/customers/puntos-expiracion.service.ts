import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * D11: Job de caducidad de puntos del Programa de Lealtad.
 *
 * Los puntos ganados se registran por lote (MovimientoPuntos tipo GANADO)
 * con fecha de vencimiento (`expiraEn`). Cuando un cliente canjea, los
 * lotes más viejos se consumen primero (FIFO). Este job revisa periódicamente
 * los remanentes de lotes vencidos, crea movimientos EXPIRADO y ajusta los
 * contadores del cliente (puntosActuales y puntosHistoricos bajan, por lo
 * que el nivel también puede descender tras el recálculo).
 */
@Injectable()
export class PuntosExpiracionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PuntosExpiracionService.name);
  /** 24 h: el job corre una vez al día. */
  private static readonly INTERVALO_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    // Primera pasada diferida para no bloquear el arranque.
    setTimeout(() => void this.procesarExpiracionPuntos(), 15_000);
    setInterval(
      () => void this.procesarExpiracionPuntos(),
      PuntosExpiracionService.INTERVALO_MS,
    );
  }

  /**
   * Procesa la caducidad de todos los clientes con lotes vencidos pendientes.
   * Idempotente: un lote solo expira una vez (su remanente pasa a consumido).
   */
  async procesarExpiracionPuntos(): Promise<{
    clientesAfectados: number;
    puntosExpirados: number;
  }> {
    const ahora = new Date();
    let clientesAfectados = 0;
    let puntosExpiradosTotal = 0;

    try {
      const programas = await this.prisma.programaLealtad.findMany({
        where: { habilitado: true, mesesExpiracionPuntos: { gt: 0 } },
        select: {
          id: true,
          empresaId: true,
          niveles: { orderBy: { umbralPuntos: 'asc' } },
        },
      });

      for (const programa of programas) {
        const clientes = await this.prisma.cliente.findMany({
          where: { empresaId: programa.empresaId },
          select: { id: true, puntosHistoricos: true, nivelLealtadId: true },
        });

        for (const cliente of clientes) {
          const resultado = await this.expirarLotesVencidos(
            cliente.id,
            ahora,
            programa.niveles,
          );
          if (resultado.puntosExpirados > 0) {
            clientesAfectados += 1;
            puntosExpiradosTotal += resultado.puntosExpirados;
            this.logger.log(
              `Lealtad D11: ${resultado.puntosExpirados} puntos expiraron para el cliente ${cliente.id} (${resultado.lotes.length} lote(s))`,
            );
          }
        }
      }

      if (clientesAfectados > 0) {
        this.logger.log(
          `Lealtad D11: expiración procesada — ${clientesAfectados} cliente(s), ${puntosExpiradosTotal} puntos`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Lealtad D11: error procesando expiración de puntos',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return { clientesAfectados, puntosExpirados: puntosExpiradosTotal };
  }

  /**
   * Expira el remanente no consumido de los lotes GANADO vencidos de un
   * cliente. Ajusta puntosActuales/puntosHistoricos y recalcula el nivel.
   */
  private async expirarLotesVencidos(
    clienteId: string,
    ahora: Date,
    niveles: { id: string; umbralPuntos: number }[],
  ): Promise<{ puntosExpirados: number; lotes: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const lotesVencidos = await tx.movimientoPuntos.findMany({
        where: {
          clienteId,
          tipo: 'GANADO',
          expiraEn: { not: null, lte: ahora },
        },
        orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      });

      const lotesConRemanente = lotesVencidos.filter(
        (lote) => (lote.expiraEn as Date).getTime() <= ahora.getTime() && lote.puntos > lote.puntosConsumidos,
      );
      if (lotesConRemanente.length === 0) {
        return { puntosExpirados: 0, lotes: [] };
      }

      let totalExpirado = 0;
      for (const lote of lotesConRemanente) {
        const aExpirar = lote.puntos - lote.puntosConsumidos;
        await tx.movimientoPuntos.update({
          where: { id: lote.id },
          data: { puntosConsumidos: lote.puntos },
        });
        await tx.movimientoPuntos.create({
          data: {
            clienteId,
            ventaId: lote.ventaId,
            tipo: 'EXPIRADO',
            puntos: -aExpirar,
          },
        });
        totalExpirado += aExpirar;
      }

      const cliente = await tx.cliente.findUniqueOrThrow({
        where: { id: clienteId },
        select: { puntosHistoricos: true },
      });
      const historicosRestantes = Math.max(
        0,
        cliente.puntosHistoricos - totalExpirado,
      );

      const alcanzables = niveles.filter(
        (n) => historicosRestantes >= n.umbralPuntos,
      );
      const nuevoNivel =
        alcanzables.length > 0
          ? alcanzables.reduce((mayor, actual) =>
              actual.umbralPuntos > mayor.umbralPuntos ? actual : mayor,
            )
          : null;

      await tx.cliente.update({
        where: { id: clienteId },
        data: {
          puntosActuales: { decrement: totalExpirado },
          puntosHistoricos: { set: historicosRestantes },
          nivelLealtadId: nuevoNivel?.id ?? null,
        },
      });

      return {
        puntosExpirados: totalExpirado,
        lotes: lotesConRemanente.map((l) => l.id),
      };
    });
  }
}
