import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PresupuestosService } from './presupuestos.service';

/**
 * D12: Job en segundo plano que expira presupuestos automáticamente.
 *
 * Es el análogo a cómo se "actualizan solas" las caducidades de inventario:
 * de forma periódica, sin esperar a que alguien consulte el recurso, marca
 * como "vencido" los presupuestos abiertos que superaron su ventana de
 * expiración configurada (Empresa.diasExpiracionPresupuesto).
 *
 * Se complementa con el marcado perezoso (marcarVencidos) que ya ocurre al
 * listar/detallar, garantizando que el estado esté siempre fresco incluso
 * entre ejecuciones del job.
 */
@Injectable()
export class PresupuestosExpiracionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PresupuestosExpiracionService.name);
  /** 24 h: el job corre una vez al día. */
  private static readonly INTERVALO_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly presupuestosService: PresupuestosService) {}

  onApplicationBootstrap() {
    // Primera pasada diferida para no bloquear el arranque.
    setTimeout(() => void this.procesarExpiracion(), 15_000);
    setInterval(
      () => void this.procesarExpiracion(),
      PresupuestosExpiracionService.INTERVALO_MS,
    );
  }

  /**
   * Marca como vencidos los presupuestos abiertos de todas las empresas que
   * superaron su expiración. Idempotente: un presupuesto solo pasa a vencido
   * una vez (cuando su estado deja de ser 'abierto' ya no se vuelve a tocar).
   */
  async procesarExpiracion(): Promise<void> {
    try {
      const res = await this.presupuestosService.marcarVencidosGlobal();
      if (res.marcados > 0) {
        this.logger.log(
          `Presupuestos D12: expiración procesada — ${res.marcados} presupuesto(s) marcado(s) vencido(s) en ${res.revisadas} empresa(s)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Presupuestos D12: error procesando expiración',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
