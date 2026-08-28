import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { RetiroParcialDto } from './dto/retiro-parcial.dto';
import { CorteZDto } from './dto/corte-z.dto';
import { ModoCorteZ } from '@prisma/client';

@Injectable()
export class CashRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Obtener todas las cajas disponibles de la empresa.
   * @param empresaId Identificador de la empresa.
   * @returns Lista de cajas con su sucursal.
   */
  async getCajas(empresaId: string) {
    return this.prisma.caja.findMany({
      where: {
        sucursal: { empresaId },
      },
      include: {
        sucursal: true,
      },
    });
  }

  /**
   * Obtener la configuración de cortes de la empresa (modo Corte Z y umbral
   * de faltante crítico) para el terminal POS.
   * @param empresaId UUID de la empresa.
   * @returns Configuración de cortes.
   */
  async getSettings(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        modoCorteZ: true,
        umbralFaltanteCritico: true,
      },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return {
      modoCorteZ: empresa.modoCorteZ || ModoCorteZ.ciego,
      umbralFaltanteCritico: empresa.umbralFaltanteCritico ?? 50.0,
    };
  }

  /**
   * Listar todas las sesiones de caja abiertas de la empresa (vista de
   * administración). Incluye desglose de ventas, retiros, efectivo esperado,
   * antigüedad y monto acumulado, útil para monitoreo y corte a distancia.
   * @param empresaId UUID de la empresa.
   * @returns Lista de sesiones abiertas con datos de corte.
   */
  async listarSesionesAbiertas(empresaId: string) {
    const sesiones = await this.prisma.sesionCaja.findMany({
      where: {
        estado: 'abierta',
        caja: { sucursal: { empresaId } },
      },
      include: {
        caja: {
          include: { sucursal: true },
        },
        cajero: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
        retiros: { select: { id: true, monto: true, motivo: true } },
      },
      orderBy: { fechaApertura: 'asc' },
    });

    const ahora = new Date();
    return sesiones.map((s) => {
      const efectivoEsperado =
        s.montoInicial + s.totalVentasEfectivo - s.totalRetiros;
      const minutosAbierta = Math.floor(
        (ahora.getTime() - new Date(s.fechaApertura).getTime()) / 60000,
      );
      return {
        id: s.id,
        caja: {
          id: s.caja.id,
          nombre: s.caja.nombre,
          sucursal: {
            id: s.caja.sucursal.id,
            nombre: s.caja.sucursal.nombre,
          },
        },
        cajero: s.cajero,
        modoCorteUsado: s.modoCorteUsado,
        montoInicial: s.montoInicial,
        totalVentasEfectivo: s.totalVentasEfectivo,
        totalVentasTarjeta: s.totalVentasTarjeta,
        totalVentasOtros: s.totalVentasOtros,
        totalRetiros: s.totalRetiros,
        efectivoEsperado,
        fechaApertura: s.fechaApertura,
        minutosAbierta,
      };
    });
  }

  /**
   * Previsualizar el Corte Z de una sesión abierta sin cerrarla.
   * Calcula el desglose completo que se registraría al momento del cierre.
   * @param empresaId UUID de la empresa.
   * @param sesionCajaId UUID de la sesión de caja.
   * @returns Desglose de la vista previa del corte o null si no existe.
   */
  async previsualizarCorteZ(empresaId: string, sesionCajaId: string) {
    const sesion = await this.prisma.sesionCaja.findFirst({
      where: { id: sesionCajaId, caja: { sucursal: { empresaId } } },
      include: {
        caja: { include: { sucursal: true } },
        cajero: { select: { id: true, nombre: true, rol: true } },
        retiros: { select: { id: true, monto: true, motivo: true } },
      },
    });

    if (!sesion || sesion.estado !== 'abierta') return null;

    const efectivoEsperado =
      sesion.montoInicial + sesion.totalVentasEfectivo - sesion.totalRetiros;
    const totalVentas =
      sesion.totalVentasEfectivo + sesion.totalVentasTarjeta + sesion.totalVentasOtros;

    return {
      sesionCajaId: sesion.id,
      caja: {
        id: sesion.caja.id,
        nombre: sesion.caja.nombre,
        sucursal: { id: sesion.caja.sucursal.id, nombre: sesion.caja.sucursal.nombre },
      },
      cajero: sesion.cajero,
      modoCorteUsado: sesion.modoCorteUsado,
      fechaApertura: sesion.fechaApertura,
      montoInicial: sesion.montoInicial,
      ventas: {
        efectivo: sesion.totalVentasEfectivo,
        tarjeta: sesion.totalVentasTarjeta,
        otros: sesion.totalVentasOtros,
        total: totalVentas,
      },
      retiros: sesion.retiros,
      totalRetiros: sesion.totalRetiros,
      efectivoEsperado,
    };
  }

  /**
   * Obtener la sesión de caja activa de la sucursal/usuario.
   * @param usuarioId UUID del usuario autenticado.
   * @param cajaId UUID opcional de la caja (si se quiere buscar por caja específica).
   * @returns La sesión activa o null si no existe.
   */
  async getCurrentSession(usuarioId: string, cajaId?: string) {
    const sesion = await this.prisma.sesionCaja.findFirst({
      where: {
        ...(cajaId ? { cajaId } : { cajeroId: usuarioId }),
        estado: 'abierta',
      },
      include: {
        caja: true,
        cajero: {
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true,
          },
        },
        retiros: true,
      },
    });

    return sesion;
  }

  /**
   * Abrir un nuevo turno de caja con fondo inicial.
   * Registra log de auditoría y notifica al gerente.
   * @param usuarioId UUID del cajero.
   * @param empresaId UUID de la empresa.
   * @param dto Datos de apertura (cajaId, montoInicial).
   * @returns La sesión de caja creada.
   */
  async openSession(usuarioId: string, empresaId: string, dto: AbrirCajaDto) {
    // Si no se proporcionó cajaId o es inválida, asignar la primera caja activa de la empresa
    if (!dto.cajaId || dto.cajaId === 'default-caja-id') {
      const primeraCaja = await this.prisma.caja.findFirst({
        where: { sucursal: { empresaId } },
      });
      if (!primeraCaja) {
        throw new NotFoundException(
          'No existe ninguna caja configurada para esta empresa',
        );
      }
      dto.cajaId = primeraCaja.id;
    }

    // 1. Verificar que la caja exista y pertenezca a la empresa
    const caja = await this.prisma.caja.findFirst({
      where: {
        id: dto.cajaId,
        sucursal: { empresaId },
      },
      include: { sucursal: true },
    });

    if (!caja) {
      throw new NotFoundException('La caja especificada no existe');
    }

    // 2. Verificar que la caja no tenga un turno abierto actualmente
    const sesionActiva = await this.prisma.sesionCaja.findFirst({
      where: {
        cajaId: dto.cajaId,
        estado: 'abierta',
      },
    });

    if (sesionActiva) {
      // Si la sesión activa pertenece al mismo usuario, simplemente retornarla
      if (sesionActiva.cajeroId === usuarioId) {
        return sesionActiva;
      }
      throw new ConflictException(
        'La caja seleccionada ya tiene un turno abierto por otro usuario',
      );
    }

    // 3. Obtener el modo de corte Z configurado para la empresa
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });

    const modoCorte = empresa?.modoCorteZ || ModoCorteZ.ciego;

    // 4. Crear la sesión de caja
    const sesion = await this.prisma.sesionCaja.create({
      data: {
        cajaId: dto.cajaId,
        cajeroId: usuarioId,
        montoInicial: dto.montoInicial,
        modoCorteUsado: modoCorte,
        estado: 'abierta',
      },
      include: {
        caja: true,
        cajero: {
          select: { id: true, nombre: true, rol: true },
        },
      },
    });

    // 5. Registrar log de auditoría
    await this.auditService.registrarEvento({
      empresaId,
      sucursalId: caja.sucursalId,
      usuarioId,
      accion: 'APERTURA_CAJA',
      entidadTipo: 'sesion_caja',
      entidadId: sesion.id,
      detalles: {
        cajaId: dto.cajaId,
        cajaNombre: caja.nombre,
        montoInicial: dto.montoInicial,
        modoCorte,
      },
      severidad: 'info',
    });

    // 6. Notificar al gerente
    const nombreCajero = sesion.cajero?.nombre || 'Cajero';
    await this.notificationsService.notificarAdminsYGerentes(empresaId, {
      titulo: 'Caja abierta',
      mensaje: `${nombreCajero} abrió ${caja.nombre} con fondo inicial de $${dto.montoInicial.toFixed(2)}`,
      tipo: 'info',
      evento: 'caja_abierta',
      entidadTipo: 'sesion_caja',
      entidadId: sesion.id,
    });

    return sesion;
  }

  /**
   * Registrar un retiro parcial de efectivo de la caja.
   * Registra log de auditoría (severidad: warning) y notifica a admin/gerente.
   * @param usuarioId UUID del usuario que realiza el retiro.
   * @param empresaId UUID de la empresa.
   * @param dto Datos del retiro (sesionCajaId, monto, motivo).
   * @returns El retiro parcial creado.
   */
  async addWithdrawal(
    usuarioId: string,
    empresaId: string,
    dto: RetiroParcialDto,
  ) {
    const sesion = await this.prisma.sesionCaja.findUnique({
      where: { id: dto.sesionCajaId },
      include: { caja: true },
    });

    if (!sesion || sesion.estado !== 'abierta') {
      throw new BadRequestException(
        'La sesión de caja no existe o ya está cerrada',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const retiro = await tx.retiroParcial.create({
        data: {
          sesionCajaId: dto.sesionCajaId,
          usuarioId,
          monto: dto.monto,
          motivo: dto.motivo,
        },
      });

      await tx.sesionCaja.update({
        where: { id: dto.sesionCajaId },
        data: {
          totalRetiros: { increment: dto.monto },
        },
      });

      return retiro;
    });

    // Registrar log de auditoría (warning porque implica movimiento de efectivo)
    await this.auditService.registrarEvento({
      empresaId,
      sucursalId: sesion.caja?.sucursalId,
      usuarioId,
      accion: 'RETIRO_PARCIAL',
      entidadTipo: 'retiro_parcial',
      entidadId: resultado.id,
      detalles: {
        sesionCajaId: dto.sesionCajaId,
        monto: dto.monto,
        motivo: dto.motivo,
        cajaNombre: sesion.caja?.nombre,
      },
      severidad: 'warning',
    });

    // Notificar a admin/gerente
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true },
    });

    await this.notificationsService.notificarAdminsYGerentes(empresaId, {
      titulo: 'Retiro parcial de efectivo',
      mensaje: `${usuario?.nombre || 'Usuario'} retiró $${dto.monto.toFixed(2)} de ${sesion.caja?.nombre || 'la caja'}. Motivo: ${dto.motivo}`,
      tipo: 'warning',
      evento: 'retiro_parcial',
      entidadTipo: 'retiro_parcial',
      entidadId: resultado.id,
    });

    return resultado;
  }

  /**
   * Generar Corte X (corte informativo durante el turno, no cierra la sesión).
   * Registra log de auditoría.
   * @param usuarioId UUID del usuario que realiza el corte.
   * @param empresaId UUID de la empresa.
   * @param sesionCajaId UUID de la sesión de caja.
   * @returns El Corte X creado.
   */
  async generateCorteX(
    usuarioId: string,
    empresaId: string,
    sesionCajaId: string,
  ) {
    const sesion = await this.prisma.sesionCaja.findUnique({
      where: { id: sesionCajaId },
      include: { caja: true },
    });

    if (!sesion || sesion.estado !== 'abierta') {
      throw new BadRequestException(
        'La sesión de caja especificada no está abierta',
      );
    }

    const efectivoEnCaja =
      sesion.montoInicial + sesion.totalVentasEfectivo - sesion.totalRetiros;

    const corteX = await this.prisma.corteX.create({
      data: {
        sesionCajaId,
        usuarioId,
        montoInicial: sesion.montoInicial,
        totalVentasEfectivo: sesion.totalVentasEfectivo,
        totalVentasTarjeta: sesion.totalVentasTarjeta,
        montoRetiros: sesion.totalRetiros,
        efectivoEnCaja,
      },
    });

    // Registrar log de auditoría
    await this.auditService.registrarEvento({
      empresaId,
      sucursalId: sesion.caja?.sucursalId,
      usuarioId,
      accion: 'CORTE_X',
      entidadTipo: 'corte_x',
      entidadId: corteX.id,
      detalles: {
        sesionCajaId,
        montoInicial: sesion.montoInicial,
        totalVentasEfectivo: sesion.totalVentasEfectivo,
        totalVentasTarjeta: sesion.totalVentasTarjeta,
        montoRetiros: sesion.totalRetiros,
        efectivoEnCaja,
      },
      severidad: 'info',
    });

    return corteX;
  }

  /**
   * Cerrar el turno de caja (Corte Z) con manejo de discrepancias.
   *
   * Lógica de discrepancia:
   * - diferencia == 0 → 'cuadre' (info)
   * - diferencia > 0  → 'sobrante' (warning, notas obligatorias)
   * - diferencia < 0  → 'faltante'
   *   - |diferencia| <= umbral → warning, se permite cerrar
   *   - |diferencia| > umbral  → critical, requiere autorizadoPorId de ADMIN/GERENTE
   *
   * @param usuarioId UUID del cajero que cierra.
   * @param empresaId UUID de la empresa.
   * @param dto Datos del cierre (montoDeclarado, notas, autorizadoPorId).
   * @returns La sesión cerrada y el corte Z creado.
   */
  async closeSessionZ(usuarioId: string, empresaId: string, dto: CorteZDto) {
    const sesion = await this.prisma.sesionCaja.findUnique({
      where: { id: dto.sesionCajaId },
      include: {
        caja: {
          include: {
            sucursal: true,
          },
        },
        cajero: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!sesion || sesion.estado !== 'abierta') {
      throw new BadRequestException(
        'La sesión de caja no está disponible para cierre o ya fue cerrada',
      );
    }

    // Verificar que la sesión pertenezca a la empresa (crítico para cierre a
    // distancia desde otras sucursales o por otro rol).
    if (sesion.caja?.sucursal?.empresaId !== empresaId) {
      throw new BadRequestException(
        'La sesión de caja no pertenece a esta empresa',
      );
    }

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });

    const modoCorte = empresa?.modoCorteZ || ModoCorteZ.ciego;
    const umbralCritico = empresa?.umbralFaltanteCritico ?? 50.0;

    // Calcular el efectivo esperado y la diferencia
    const montoEsperado =
      sesion.montoInicial + sesion.totalVentasEfectivo - sesion.totalRetiros;
    const diferencia = dto.montoDeclarado - montoEsperado;

    // Clasificar la discrepancia
    let tipoDiscrepancia: string;
    let severidad: string;

    if (diferencia === 0) {
      tipoDiscrepancia = 'cuadre';
      severidad = 'info';
    } else if (diferencia > 0) {
      tipoDiscrepancia = 'sobrante';
      severidad = 'warning';
    } else {
      tipoDiscrepancia = 'faltante';
      severidad = Math.abs(diferencia) > umbralCritico ? 'critical' : 'warning';
    }

    // Validar notas obligatorias cuando hay discrepancia
    if (
      tipoDiscrepancia !== 'cuadre' &&
      (!dto.notas || dto.notas.trim() === '')
    ) {
      throw new BadRequestException(
        `Se requiere una justificación (notas) cuando hay un ${tipoDiscrepancia} en el corte de caja`,
      );
    }

    // Validar autorización para faltantes críticos
    if (
      tipoDiscrepancia === 'faltante' &&
      Math.abs(diferencia) > umbralCritico
    ) {
      if (!dto.autorizadoPorId) {
        throw new ForbiddenException(
          `Faltante crítico de $${Math.abs(diferencia).toFixed(2)} (supera el umbral de $${umbralCritico.toFixed(2)}). Se requiere la autorización de un Administrador o Gerente para cerrar el turno.`,
        );
      }

      // Verificar que el autorizador sea un ADMIN o GERENTE válido de la empresa
      const autorizador = await this.prisma.usuario.findFirst({
        where: {
          id: dto.autorizadoPorId,
          empresaId,
          estaActivo: true,
          rol: { in: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'] },
        },
      });

      if (!autorizador) {
        throw new ForbiddenException(
          'El usuario autorizador no es un Administrador o Gerente válido de esta empresa',
        );
      }
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear registro de Corte Z con clasificación de discrepancia
      const corteZ = await tx.corteZ.create({
        data: {
          sesionCajaId: dto.sesionCajaId,
          usuarioId,
          montoInicial: sesion.montoInicial,
          totalVentasEfectivo: sesion.totalVentasEfectivo,
          totalVentasTarjeta: sesion.totalVentasTarjeta,
          totalRetiros: sesion.totalRetiros,
          montoEsperado,
          montoDeclarado: dto.montoDeclarado,
          diferencia,
          tipoDiscrepancia,
          modoCorte,
          notas: dto.notas,
          autorizadoPorId: dto.autorizadoPorId || null,
        },
      });

      // 2. Cerrar la sesión de caja
      const sesionCerrada = await tx.sesionCaja.update({
        where: { id: dto.sesionCajaId },
        data: {
          estado: 'cerrada',
          fechaCierre: new Date(),
          montoFinalEfectivo: dto.montoDeclarado,
          montoEsperadoEfectivo: montoEsperado,
          diferenciaEfectivo: diferencia,
          modoCorteUsado: modoCorte,
        },
      });

      return {
        sesion: sesionCerrada,
        corteZ,
      };
    });

    // 3. Registrar log de auditoría
    const nombreCajero = sesion.cajero?.nombre || 'Cajero';
    await this.auditService.registrarEvento({
      empresaId,
      sucursalId: sesion.caja?.sucursalId,
      usuarioId,
      accion: 'CORTE_Z',
      entidadTipo: 'corte_z',
      entidadId: resultado.corteZ.id,
      detalles: {
        sesionCajaId: dto.sesionCajaId,
        cajaNombre: sesion.caja?.nombre,
        cajeroNombre: nombreCajero,
        montoInicial: sesion.montoInicial,
        totalVentasEfectivo: sesion.totalVentasEfectivo,
        totalVentasTarjeta: sesion.totalVentasTarjeta,
        totalRetiros: sesion.totalRetiros,
        montoEsperado,
        montoDeclarado: dto.montoDeclarado,
        diferencia,
        tipoDiscrepancia,
        modoCorte,
        notas: dto.notas,
        autorizadoPorId: dto.autorizadoPorId || null,
      },
      severidad,
    });

    // 4. Notificar según tipo de discrepancia
    let tituloNotificacion: string;
    let mensajeNotificacion: string;
    let tipoNotificacion: 'info' | 'warning' | 'critical';

    if (tipoDiscrepancia === 'cuadre') {
      tituloNotificacion = 'Caja cerrada correctamente ✅';
      mensajeNotificacion = `${nombreCajero} cerró ${sesion.caja?.nombre || 'la caja'} con cuadre perfecto. Efectivo: $${dto.montoDeclarado.toFixed(2)}`;
      tipoNotificacion = 'info';
    } else if (tipoDiscrepancia === 'sobrante') {
      tituloNotificacion = '⚠️ Sobrante en caja';
      mensajeNotificacion = `${nombreCajero} cerró ${sesion.caja?.nombre || 'la caja'} con sobrante de $${diferencia.toFixed(2)}. Esperado: $${montoEsperado.toFixed(2)}, Contado: $${dto.montoDeclarado.toFixed(2)}`;
      tipoNotificacion = 'warning';
    } else {
      tituloNotificacion = '🚨 Faltante en caja';
      mensajeNotificacion = `${nombreCajero} cerró ${sesion.caja?.nombre || 'la caja'} con faltante de $${Math.abs(diferencia).toFixed(2)}. Esperado: $${montoEsperado.toFixed(2)}, Contado: $${dto.montoDeclarado.toFixed(2)}`;
      tipoNotificacion =
        Math.abs(diferencia) > umbralCritico ? 'critical' : 'warning';
    }

    await this.notificationsService.notificarAdminsYGerentes(empresaId, {
      titulo: tituloNotificacion,
      mensaje: mensajeNotificacion,
      tipo: tipoNotificacion,
      evento:
        tipoDiscrepancia === 'cuadre' ? 'corte_z_realizado' : 'faltante_caja',
      entidadTipo: 'corte_z',
      entidadId: resultado.corteZ.id,
    });

    return resultado;
  }
}
