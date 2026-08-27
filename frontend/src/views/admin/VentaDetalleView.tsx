import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Coins,
  Package,
  CreditCard,
  Clock,
} from 'lucide-react';

interface MovimientoLealtadInfo {
  tipo: 'GANADO' | 'CANJEADO' | 'EXPIRADO' | 'AJUSTE';
  puntos: number;
  expiraEn: string | null;
}

interface VentaDetallePage {
  id: string;
  folio: string;
  estado: string;
  creadoEn: string;
  subtotal: number;
  descuento: number;
  descuentoNivel: number;
  descuentoCanje: number;
  impuestos: number;
  total: number;
  cajero?: { nombre: string } | null;
  cliente?: { id: string; nombre: string; apellidoPaterno: string | null } | null;
  movimientosPuntos?: MovimientoLealtadInfo[];
  detalles: Array<{
    id: string;
    nombreProducto: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    total: number;
  }>;
  pagos: Array<{
    id: string;
    metodo: string;
    montoRecibido: number;
    montoPagado: number;
    cambio: number;
    referencia?: string | null;
  }>;
  ventaCredito?: {
    montoTotal: number;
    montoPagado: number;
    saldoPendiente: number;
    estado: string;
    fechaVencimiento: string;
  } | null;
}

export default function VentaDetalleView() {
  const { id } = useParams<{ id: string }>();
  const [venta, setVenta] = useState<VentaDetallePage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await api.get<VentaDetallePage>(`/sales/${id}`);
        setVenta(res.data);
      } catch {
        toast.error('No se pudo cargar la venta');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  /** Resumen de lealtad de esta venta */
  const nombreCliente = venta?.cliente
    ? `${venta.cliente.nombre} ${venta.cliente.apellidoPaterno ?? ''}`.trim()
    : null;
  const ptsGanados =
    venta?.movimientosPuntos
      ?.filter((m) => m.tipo === 'GANADO')
      .reduce((acc, m) => acc + m.puntos, 0) ?? 0;
  const ptsCanjeados =
    venta?.movimientosPuntos
      ?.filter((m) => m.tipo === 'CANJEADO')
      .reduce((acc, m) => acc + Math.abs(m.puntos), 0) ?? 0;
  const vencimientoLote =
    venta?.movimientosPuntos?.find((m) => m.tipo === 'GANADO')?.expiraEn ??
    null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a clientes
      </Link>

      {loading || !venta ? (
        <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando venta...</span>
        </div>
      ) : (
        <>
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-bold font-display text-on-background">
                Venta {venta.folio}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                {new Date(venta.creadoEn).toLocaleString()}
                {venta.cajero?.nombre
                  ? ` · Atendió: ${venta.cajero.nombre}`
                  : ''}
              </p>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                venta.estado === 'completada'
                  ? 'bg-success/10 text-success'
                  : 'bg-error/10 text-error'
              }`}
            >
              {venta.estado}
            </span>
          </div>

          {/* Lealtad: ¿generó puntos? */}
          <section className="rounded-xl border border-outline/20 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-on-background">Lealtad</h2>
            </div>
            {!nombreCliente ? (
              <p className="text-sm text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined !text-[18px] text-on-surface-variant">
                  person_off
                </span>
                Venta sin cliente registrado — no generó puntos.
              </p>
            ) : ptsGanados > 0 ? (
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold mr-2">
                    +{ptsGanados} pts
                  </span>
                  Generó puntos para{' '}
                  <strong className="text-on-background">{nombreCliente}</strong>
                </p>
                {vencimientoLote && (
                  <p className="text-xs text-on-surface-variant ml-1">
                    Estos puntos vencen el{' '}
                    {new Date(vencimientoLote).toLocaleDateString()}.
                  </p>
                )}
              </div>
            ) : ptsCanjeados > 0 ? (
              <p className="text-sm">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold mr-2">
                  −{ptsCanjeados} pts
                </span>
                Canje realizado por{' '}
                <strong className="text-on-background">{nombreCliente}</strong>
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined !text-[18px] text-on-surface-variant">
                  info
                </span>
                Cliente registrado ({nombreCliente}), pero esta venta no
                generó puntos (revisa el mínimo de compra o la configuración
                del programa).
              </p>
            )}
          </section>

          {/* Productos */}
          <section className="rounded-xl border border-outline/20 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-on-background">Productos</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-variant/50 text-left text-on-surface-variant rounded-t-lg">
                  <th className="px-3 py-2 font-medium rounded-tl-lg">
                    Producto
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Cant.</th>
                  <th className="px-3 py-2 font-medium text-right">
                    P. unitario
                  </th>
                  <th className="px-3 py-2 font-medium text-right rounded-tr-lg">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/10">
                {venta.detalles.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2">{d.nombreProducto}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d.cantidad} {d.unidadMedida}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      ${d.precioUnitario.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      ${d.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Totales */}
            <section className="rounded-xl border border-outline/20 p-4">
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    ${venta.subtotal.toFixed(2)}
                  </span>
                </div>
                {/* #5: desglose de descuentos por concepto */}
                {venta.descuento > 0 && (
                  <>
                    {(() => {
                      const descProductos =
                        Math.round(
                          (venta.descuento -
                            venta.descuentoNivel -
                            venta.descuentoCanje) *
                            100,
                        ) / 100;
                      return (
                        <>
                          {descProductos > 0 && (
                            <div className="flex justify-between text-success">
                              <span>Descuento aplicado</span>
                              <span className="tabular-nums">
                                -${descProductos.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {venta.descuentoNivel > 0 && (
                            <div className="flex justify-between text-success">
                              <span>Descuento por nivel del cliente</span>
                              <span className="tabular-nums">
                                -${venta.descuentoNivel.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {venta.descuentoCanje > 0 && (
                            <div className="flex justify-between text-success">
                              <span>
                                Canje de puntos
                                {ptsCanjeados > 0
                                  ? ` (${ptsCanjeados} pts)`
                                  : ''}
                              </span>
                              <span className="tabular-nums">
                                -${venta.descuentoCanje.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {venta.descuentoNivel === 0 &&
                            venta.descuentoCanje === 0 &&
                            descProductos <= 0 && (
                              <div className="flex justify-between text-success">
                                <span>Descuento</span>
                                <span className="tabular-nums">
                                  -${venta.descuento.toFixed(2)}
                                </span>
                              </div>
                            )}
                        </>
                      );
                    })()}
                  </>
                )}
                <div className="flex justify-between text-on-surface-variant">
                  <span>Impuestos</span>
                  <span className="tabular-nums">
                    ${venta.impuestos.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-outline/20 pt-1 mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">
                    ${venta.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </section>

            {/* Pagos */}
            <section className="rounded-xl border border-outline/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-on-background">Pagos</h2>
              </div>
              {venta.pagos.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Sin pagos registrados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {venta.pagos.map((p) => (
                    <li
                      key={p.id}
                      className="text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="capitalize text-on-surface-variant">
                          {p.metodo}
                        </span>
                        <span className="font-medium tabular-nums">
                          ${p.montoPagado.toFixed(2)}
                        </span>
                      </div>
                      {p.referencia && (
                        <p className="text-xs text-primary mt-0.5 italic">
                          {p.referencia}
                        </p>
                      )}
                      {/* #3: detalle de efectivo recibido y cambio entregado */}
                      {p.metodo === 'efectivo' && p.montoRecibido > 0 && (
                        <div className="flex items-center justify-between text-xs text-on-surface-variant mt-0.5">
                          <span>
                            Recibido: ${p.montoRecibido.toFixed(2)}
                          </span>
                          <span className="tabular-nums">
                            Cambio: ${p.cambio.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                  {venta.pagos.some((p) => p.metodo === 'efectivo' && p.cambio > 0) && (
                    (() => {
                      const cambioTotal =
                        venta.pagos
                          .filter((p) => p.metodo === 'efectivo')
                          .reduce((acc, p) => acc + p.cambio, 0);
                      return cambioTotal > 0 ? (
                        <li className="mt-3 p-3 rounded-xl bg-success/10 border border-success/30 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                            Cambio a entregar
                          </span>
                          <span className="text-xl font-bold font-mono text-success tabular-nums">
                            ${cambioTotal.toFixed(2)}
                          </span>
                        </li>
                      ) : null;
                    })()
                  )}
                </ul>
              )}
            </section>

            {/* Sección de crédito (si la venta fue a crédito) */}
            {venta.ventaCredito && (
              <section className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-warning" />
                  <h2 className="font-semibold text-on-background">
                    Venta a crédito
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      venta.ventaCredito.estado === 'liquidada'
                        ? 'bg-success/10 text-success'
                        : venta.ventaCredito.estado === 'vencida'
                          ? 'bg-error/10 text-error'
                          : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {venta.ventaCredito.estado === 'liquidada'
                      ? 'Liquidada'
                      : venta.ventaCredito.estado === 'vencida'
                        ? 'Vencida'
                        : venta.ventaCredito.estado === 'parcialmente_pagada'
                          ? 'Parcial'
                          : 'Pendiente'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-on-surface-variant">Monto total</p>
                    <p className="font-bold text-on-surface">
                      ${venta.ventaCredito.montoTotal.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Pagado</p>
                    <p className="font-bold text-success">
                      ${venta.ventaCredito.montoPagado.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Pendiente</p>
                    <p className="font-bold text-error">
                      ${venta.ventaCredito.saldoPendiente.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-warning/20">
                  <p className="text-xs text-on-surface-variant">
                    Vencimiento:{' '}
                    {new Date(venta.ventaCredito.fechaVencimiento).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-xs text-on-surface leading-relaxed">
                    Esta venta fue realizada a crédito. <strong>No se realizó cobro en efectivo.</strong>{' '}
                    El saldo se registra como deuda del cliente.
                  </p>
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
