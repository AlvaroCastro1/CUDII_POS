import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ============================================================
// Interfaces
// ============================================================
export interface Categoria {
  id: string;
  nombre: string;
  icono?: string;
  colorHex?: string;
}

export interface PrecioUnidad {
  id: string;
  unidad: string;
  nombreAlternativo?: string;
  cantidadMinima: number;
  precio: number;
  esDefault: boolean;
}

export interface Producto {
  id: string;
  nombre: string;
  codigoBarras: string;
  codigoInterno: string;
  descripcion: string;
  precioVentaBase: number;
  precioCompra: number;
  unidadMedida: string;
  esGranel: boolean;
  estaActivo: boolean;
  tieneCaducidad?: boolean;
  manejaInventario?: boolean;
  metodoRotacion?: 'FIFO' | 'FEFO';
  categorias: Categoria[];
  preciosPorUnidad: PrecioUnidad[];
}

interface PrecioForm {
  id: string;
  tipo: string;
  nombreAlternativo: string;
  cantidadMinima: string;
  precio: string;
  activo: boolean;
}

interface OptionTipoPrecio {
  valor: string;
  label: string;
  color: string;
  icono: string;
  desc: string;
  defaultNombre: string;
  defaultCant: string;
}

// ============================================================
// Constantes estáticas
// ============================================================
export const UNIDADES = [
  {
    valor: 'PIEZA',
    icono: 'package_2',
    titulo: 'Pieza / Unidad',
    desc: 'Se cuenta de 1 en 1. El stock es siempre un número entero.',
    ejemplo: 'Refresco, shampoo, pelota de fútbol',
  },
  {
    valor: 'KILO',
    icono: 'scale',
    titulo: 'Kilogramo (a granel)',
    desc: 'Se lleva por peso en kg. Permite cantidades decimales (ej: 0.350 kg).',
    ejemplo: 'Arroz a granel, jamón deli, queso, bolsas de plástico',
  },
  {
    valor: 'LITRO',
    icono: 'water_drop',
    titulo: 'Litro / Volumen',
    desc: 'Se lleva por volumen líquido. Permite cantidades decimales.',
    ejemplo: 'Aceite a granel, pintura, jarabe',
  },
  {
    valor: 'METRO',
    icono: 'straighten',
    titulo: 'Metro / Longitud',
    desc: 'Se lleva por longitud. Permite cantidades decimales.',
    ejemplo: 'Tela, cable eléctrico, manguera',
  },
  {
    valor: 'SERVICIO',
    icono: 'build',
    titulo: 'Servicio',
    desc: 'No descuenta inventario. Para mano de obra o servicios digitales.',
    ejemplo: 'Corte de cabello, consultoría, reparación',
  },
];

const TIPOS_PRECIO_POR_UNIDAD: Record<string, OptionTipoPrecio[]> = {
  PIEZA: [
    { valor: 'PAQUETE', label: 'Paquete / Pack', color: '#f59e0b', icono: 'grid_view', desc: 'Ej: Six-pack (6 pzas), Docena (12 pzas)', defaultNombre: 'Paquete (6 pzas)', defaultCant: '6' },
    { valor: 'CAJA', label: 'Caja / Empaque', color: '#3b82f6', icono: 'inventory_2', desc: 'Ej: Caja cerrada de 24 piezas', defaultNombre: 'Caja (24 pzas)', defaultCant: '24' },
    { valor: 'MAYOREO', label: 'Mayoreo por Pieza', color: '#8b5cf6', icono: 'local_shipping', desc: 'Precio especial a partir de N piezas', defaultNombre: 'Mayoreo', defaultCant: '12' },
    { valor: 'PERSONALIZADO', label: 'Presentación personalizada', color: '#ef4444', icono: 'tune', desc: 'Define el nombre y la cantidad de piezas', defaultNombre: 'Presentación Especial', defaultCant: '10' },
  ],
  KILO: [
    { valor: 'MEDIO', label: 'Fracción / Kilo Fijo', color: '#10b981', icono: 'splitscreen', desc: 'Ej: Medio kilo (0.500 kg), Cuarto de kilo (0.250 kg)', defaultNombre: 'Medio Kilo', defaultCant: '0.5' },
    { valor: 'MAYOREO', label: 'Mayoreo por Kilo', color: '#8b5cf6', icono: 'local_shipping', desc: 'Precio reducido a partir de N kilos', defaultNombre: 'Mayoreo Kilo', defaultCant: '10' },
    { valor: 'CAJA', label: 'Costal / Bulto / Caja', color: '#3b82f6', icono: 'inventory_2', desc: 'Ej: Costal de 25 kg o 50 kg', defaultNombre: 'Costal (25 kg)', defaultCant: '25' },
    { valor: 'PERSONALIZADO', label: 'Presentación personalizada', color: '#ef4444', icono: 'tune', desc: 'Define el nombre y peso en kg', defaultNombre: 'Presentación Kilo', defaultCant: '5' },
  ],
  LITRO: [
    { valor: 'MEDIO', label: 'Fracción / Litro Fijo', color: '#10b981', icono: 'splitscreen', desc: 'Ej: Medio litro (0.500 L)', defaultNombre: 'Medio Litro', defaultCant: '0.5' },
    { valor: 'MAYOREO', label: 'Mayoreo por Litro', color: '#8b5cf6', icono: 'local_shipping', desc: 'Precio especial a partir de N litros', defaultNombre: 'Mayoreo Litro', defaultCant: '10' },
    { valor: 'CAJA', label: 'Garrafón / Tambor', color: '#3b82f6', icono: 'water_drop', desc: 'Ej: Garrafón de 19 L, Tambor de 200 L', defaultNombre: 'Garrafón (19 L)', defaultCant: '19' },
    { valor: 'PERSONALIZADO', label: 'Presentación personalizada', color: '#ef4444', icono: 'tune', desc: 'Define el nombre y litros', defaultNombre: 'Presentación Litro', defaultCant: '5' },
  ],
  METRO: [
    { valor: 'MEDIO', label: 'Fracción / Metro Fijo', color: '#10b981', icono: 'splitscreen', desc: 'Ej: Medio metro (0.500 m)', defaultNombre: 'Medio Metro', defaultCant: '0.5' },
    { valor: 'MAYOREO', label: 'Mayoreo por Metro', color: '#8b5cf6', icono: 'local_shipping', desc: 'Precio especial a partir de N metros', defaultNombre: 'Mayoreo Metro', defaultCant: '10' },
    { valor: 'CAJA', label: 'Rollo / Carrete', color: '#3b82f6', icono: 'straighten', desc: 'Ej: Rollo de 50 m o 100 m', defaultNombre: 'Rollo (50 m)', defaultCant: '50' },
    { valor: 'PERSONALIZADO', label: 'Presentación personalizada', color: '#ef4444', icono: 'tune', desc: 'Define el nombre y metros', defaultNombre: 'Presentación Metro', defaultCant: '5' },
  ],
  SERVICIO: [
    { valor: 'PAQUETE', label: 'Paquete de Servicios', color: '#f59e0b', icono: 'grid_view', desc: 'Ej: Paquete de 5 sesiones o mantenimientos', defaultNombre: 'Paquete (5 servicios)', defaultCant: '5' },
    { valor: 'MAYOREO', label: 'Mayoreo / Volumen', color: '#8b5cf6', icono: 'local_shipping', desc: 'Precio especial a partir de N servicios', defaultNombre: 'Mayoreo Servicio', defaultCant: '10' },
    { valor: 'PERSONALIZADO', label: 'Presentación personalizada', color: '#ef4444', icono: 'tune', desc: 'Define el nombre y cantidad', defaultNombre: 'Paquete Especial', defaultCant: '3' },
  ],
};

const initialFormState = {
  nombre: '',
  codigoBarras: '',
  codigoInterno: '',
  descripcion: '',
  categoriasIds: [] as string[],
  unidadMedida: '',
  precioCompra: '',
  precioVentaBase: '',
  tieneCaducidad: false,
  manejaInventario: true,
  metodoRotacion: 'FEFO' as 'FIFO' | 'FEFO',
};

interface ProductoModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingProduct: Producto | null;
  categorias: Categoria[];
}

export const ProductoModalForm: React.FC<ProductoModalFormProps> = React.memo(({
  isOpen,
  onClose,
  onSuccess,
  editingProduct,
  categorias,
}) => {
  const [paso, setPaso] = useState(1);
  const [formData, setFormData] = useState(initialFormState);
  const [preciosAdicionales, setPreciosAdicionales] = useState<PrecioForm[]>([]);
  const [searchCategoria, setSearchCategoria] = useState('');
  const [mostrarConsejoPaso1, setMostrarConsejoPaso1] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar o limpiar estado al abrir/cerrar o cambiar producto a editar
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        setFormData({
          nombre: editingProduct.nombre || '',
          codigoBarras: editingProduct.codigoBarras || '',
          codigoInterno: editingProduct.codigoInterno || '',
          descripcion: editingProduct.descripcion || '',
          categoriasIds: editingProduct.categorias?.map((c) => c.id) || [],
          unidadMedida: editingProduct.unidadMedida || '',
          precioCompra: editingProduct.precioCompra?.toString() || '',
          precioVentaBase: editingProduct.precioVentaBase?.toString() || '',
          tieneCaducidad: editingProduct.tieneCaducidad || false,
          manejaInventario:
            editingProduct.manejaInventario ??
            editingProduct.unidadMedida !== 'SERVICIO',
          metodoRotacion: editingProduct.metodoRotacion || 'FEFO',
        });
        setPreciosAdicionales(
          (editingProduct.preciosPorUnidad || []).map((pp) => ({
            id: pp.id,
            tipo: pp.unidad,
            nombreAlternativo: pp.nombreAlternativo || '',
            cantidadMinima: pp.cantidadMinima.toString(),
            precio: pp.precio.toString(),
            activo: true,
          }))
        );
        setPaso(2); // Salta el paso 1 si estamos editando
      } else {
        setFormData(initialFormState);
        setPreciosAdicionales([]);
        setPaso(1);
      }
      setSearchCategoria('');
      setMostrarConsejoPaso1(false);
    }
  }, [isOpen, editingProduct]);

  // Memoizados para velocidad máxima
  const unidadSeleccionada = useMemo(
    () => UNIDADES.find((u) => u.valor === formData.unidadMedida),
    [formData.unidadMedida]
  );

  const esGranelAuto = useMemo(
    () => ['KILO', 'LITRO', 'METRO'].includes(formData.unidadMedida),
    [formData.unidadMedida]
  );

  const tiposPrecioDisponibles = useMemo(() => {
    const unidad = formData.unidadMedida || 'PIEZA';
    return TIPOS_PRECIO_POR_UNIDAD[unidad] || TIPOS_PRECIO_POR_UNIDAD.PIEZA;
  }, [formData.unidadMedida]);

  const categoriasFiltradas = useMemo(() => {
    if (!searchCategoria.trim()) return categorias;
    const term = searchCategoria.toLowerCase();
    return categorias.filter((c) => c.nombre.toLowerCase().includes(term));
  }, [categorias, searchCategoria]);

  const calcularMargenPrecio = useCallback(
    (precio: string, cantidad: string | number = 1) => {
      const compraUnitaria = parseFloat(formData.precioCompra);
      const venta = parseFloat(precio);
      const cant = parseFloat(String(cantidad)) || 1;
      
      const compraTotal = compraUnitaria * cant;
      
      if (!compraTotal || compraTotal <= 0 || !venta || venta <= 0) return null;
      return ((venta - compraTotal) / compraTotal) * 100;
    },
    [formData.precioCompra]
  );

  const margen = useMemo(
    () => calcularMargenPrecio(formData.precioVentaBase),
    [calcularMargenPrecio, formData.precioVentaBase]
  );

  const puedeAvanzarPaso1 = !!formData.unidadMedida;
  const puedeAvanzarPaso2 = formData.nombre.trim().length >= 2 && formData.codigoBarras.trim().length >= 3;
  const puedeGuardar = puedeAvanzarPaso2 && parseFloat(formData.precioVentaBase) > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Evitar salto múltiple de pasos o envío masivo si mantienen apretado Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return; 

      if (paso === 1 && puedeAvanzarPaso1) setPaso(2);
      else if (paso === 2 && puedeAvanzarPaso2) setPaso(3);
      else if (paso === 3 && puedeGuardar) ejecutarGuardado();
    }
  };

  const ejecutarGuardado = async () => {
    if (!puedeGuardar || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const preciosValidos = preciosAdicionales
        .filter((p) => p.activo && parseFloat(p.precio) > 0 && parseFloat(p.cantidadMinima) > 0)
        .map((p) => ({
          unidad: p.tipo,
          nombreAlternativo: p.nombreAlternativo || undefined,
          cantidadMinima: parseFloat(p.cantidadMinima),
          precio: parseFloat(p.precio),
        }));

      const payload = {
        nombre: formData.nombre,
        codigoBarras: formData.codigoBarras,
        codigoInterno: formData.codigoInterno || undefined,
        descripcion: formData.descripcion || undefined,
        categoriasIds: formData.categoriasIds.length > 0 ? formData.categoriasIds : undefined,
        unidadMedida: formData.unidadMedida,
        precioVentaBase: parseFloat(formData.precioVentaBase),
        precioCompra: parseFloat(formData.precioCompra) || 0,
        esGranel: esGranelAuto,
        tieneCaducidad: formData.tieneCaducidad,
        manejaInventario: formData.manejaInventario,
        metodoRotacion: formData.metodoRotacion,
        preciosAdicionales: preciosValidos.length > 0 ? preciosValidos : undefined,
      };

      if (editingProduct) {
        const editPayload: Record<string, unknown> = { ...payload };
        delete editPayload.unidadMedida;
        delete editPayload.esGranel;
        await api.patch(`/products/${editingProduct.id}`, editPayload);
        toast.success('¡Producto actualizado exitosamente!');
      } else {
        await api.post('/products', payload);
        toast.success('Producto registrado exitosamente');
      }

      onSuccess();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al guardar producto');
      } else {
        toast.error('Error al guardar producto');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <form onKeyDown={handleKeyDown} className="flex flex-col flex-1 min-h-0">
          {/* ---- Encabezado fijo ---- */}
          <div className="px-6 pt-6 pb-4 border-b border-outline/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined !text-[20px] text-primary">edit</span>
                    Editar Producto
                  </span>
                ) : (
                  'Registrar Producto'
                )}
              </DialogTitle>
              <p className="text-sm text-on-surface-variant mt-1">
                Paso {paso} de 3 —{' '}
                {paso === 1 ? 'Tipo de venta' : paso === 2 ? 'Identificación' : 'Precios'}
              </p>
              <div className="flex gap-2 mt-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`h-1 flex-1 rounded-full ${
                      n <= paso ? 'bg-primary' : 'bg-on-surface/10'
                    }`}
                  />
                ))}
              </div>
            </DialogHeader>
          </div>

          {/* ---- Cuerpo con scroll ---- */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4" style={{ willChange: 'transform' }}>
            {/* =================== PASO 1: TIPO DE UNIDAD =================== */}
            {paso === 1 && (
              <div className="py-4 space-y-3">
                {editingProduct ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl flex items-start gap-3">
                      <span className="material-symbols-outlined !text-[22px] text-warning flex-shrink-0 mt-0.5">
                        info
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-warning">
                          La unidad de medida no puede cambiarse
                        </p>
                        <p className="text-xs text-warning/80 mt-1">
                          Modificar la unidad de un producto con inventario existente generaría inconsistencias en el historial de ventas y stock.
                        </p>
                      </div>
                    </div>
                    {unidadSeleccionada && (
                      <div className="p-3 rounded-xl border-2 border-primary bg-primary/5 flex items-start gap-3">
                        <span className="material-symbols-outlined !text-[22px] mt-0.5 flex-shrink-0 text-primary">
                          {unidadSeleccionada.icono}
                        </span>
                        <div>
                          <p className="font-semibold text-sm text-primary">{unidadSeleccionada.titulo}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{unidadSeleccionada.desc}</p>
                        </div>
                        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-on-surface-variant bg-surface-variant px-2 py-1 rounded-lg">
                          <span className="material-symbols-outlined !text-[14px]">lock</span>
                          Bloqueado
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      ¿Cómo vas a <span className="font-semibold text-on-surface">llevar el conteo</span> de este producto en tu bodega?
                    </p>
                    <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                      {UNIDADES.map((u) => (
                        <button
                          key={u.valor}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, unidadMedida: u.valor, manejaInventario: u.valor !== 'SERVICIO', tieneCaducidad: u.valor === 'SERVICIO' ? false : prev.tieneCaducidad }))}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-colors flex items-start gap-3 ${
                            formData.unidadMedida === u.valor
                              ? 'border-primary bg-primary/5'
                              : 'border-outline/30 hover:border-outline hover:bg-surface-variant/50'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined !text-[22px] mt-0.5 flex-shrink-0 ${
                              formData.unidadMedida === u.valor ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                          >
                            {u.icono}
                          </span>
                          <div>
                            <p
                              className={`font-semibold text-sm ${
                                formData.unidadMedida === u.valor ? 'text-primary' : 'text-on-surface'
                              }`}
                            >
                              {u.titulo}
                            </p>
                            <p className="text-xs text-on-surface-variant mt-0.5">{u.desc}</p>
                            <p className="text-xs text-on-surface/50 mt-1">Ej: {u.ejemplo}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* ℹ️ Consejo desplegable */}
                    <div className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden transition-all duration-200 mt-2">
                      <button
                        type="button"
                        onClick={() => setMostrarConsejoPaso1((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-warning hover:bg-warning/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined !text-[18px] text-warning">tips_and_updates</span>
                          <span>¿Mismo producto vendido por Kilo y por Pieza?</span>
                        </div>
                        <span className="material-symbols-outlined !text-[18px]">
                          {mostrarConsejoPaso1 ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                      {mostrarConsejoPaso1 && (
                        <div className="px-3.5 pb-3 text-xs text-on-surface-variant space-y-1.5 border-t border-warning/20 pt-2.5">
                          <p className="leading-relaxed">
                            Por ejemplo: bolsas de plástico que compras <em>por kilo</em> pero también vendes <em>por pieza</em>.
                            En CUDII eso son <strong>dos productos separados</strong> en el catálogo: uno con unidad <em>Kilogramo</em> y otro con unidad <em>Pieza</em>.
                          </p>
                          <p className="leading-relaxed">
                            Las <strong>cajas, paquetes y precios de mayoreo</strong> <em>no son unidades distintas</em> — se configuran en el Paso 3 descontando de la misma unidad base.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* =================== PASO 2: IDENTIFICACIÓN =================== */}
            {paso === 2 && (
              <div className="py-4 space-y-4">
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Datos que identifican al producto en el sistema y en tu escáner de barras.
                </p>

                <div className="grid gap-2">
                  <Label htmlFor="nombre">
                    Nombre del producto <span className="text-error">*</span>
                  </Label>
                  <Input
                    id="nombre"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej. Coca Cola 600ml"
                  />
                  <p className="text-xs text-on-surface-variant">
                    Convención recomendada: Marca + Producto + Presentación.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="codigoBarras">
                      Código de Barras <span className="text-error">*</span>
                    </Label>
                    <Input
                      id="codigoBarras"
                      required
                      value={formData.codigoBarras}
                      onChange={(e) => setFormData((prev) => ({ ...prev, codigoBarras: e.target.value }))}
                      placeholder="7501055365470"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="codigoInterno">SKU Interno</Label>
                    <Input
                      id="codigoInterno"
                      value={formData.codigoInterno}
                      onChange={(e) => setFormData((prev) => ({ ...prev, codigoInterno: e.target.value }))}
                      placeholder="PROD-001"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Input
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Categorías (Opcional - Puedes seleccionar varias)</Label>
                  <Input
                    placeholder="Buscar categoría..."
                    value={searchCategoria}
                    onChange={(e) => setSearchCategoria(e.target.value)}
                    className="h-9 mb-1"
                  />
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, categoriasIds: [] }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        formData.categoriasIds.length === 0
                          ? 'bg-surface-variant border-outline text-on-surface shadow-sm font-medium'
                          : 'bg-transparent border-outline/20 hover:border-outline/50 text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined !text-[16px]">do_not_disturb_on</span>
                      Sin Categoría
                    </button>
                    {categoriasFiltradas.map((cat) => {
                      const isSelected = formData.categoriasIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const newIds = isSelected
                              ? formData.categoriasIds.filter((id) => id !== cat.id)
                              : [...formData.categoriasIds, cat.id];
                            setFormData((prev) => ({ ...prev, categoriasIds: newIds }));
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                            isSelected
                              ? 'border-transparent text-white shadow-md font-medium'
                              : 'bg-transparent border-outline/20 hover:border-outline/50 text-on-surface-variant'
                          }`}
                          style={isSelected ? { backgroundColor: cat.colorHex || '#3b82f6' } : {}}
                        >
                          <span className="material-symbols-outlined !text-[16px]">{cat.icono || 'category'}</span>
                          {cat.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {unidadSeleccionada && (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                    <span className="material-symbols-outlined !text-[18px] text-primary">
                      {unidadSeleccionada.icono}
                    </span>
                    <p className="text-sm text-primary font-medium">
                      Unidad seleccionada: {unidadSeleccionada.titulo}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* =================== PASO 3: PRECIOS =================== */}
            {paso === 3 && (
              <div className="py-4 space-y-4">
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Define el <strong>precio principal</strong> y agrega precios escalonados opcionales.
                </p>

                {/* --- Precio Base --- */}
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined !text-[18px] text-primary">sell</span>
                    <p className="text-sm font-semibold text-primary">Precio Base (obligatorio)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="precioCompra" className="text-xs">
                        Precio de Compra
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                        <Input
                          id="precioCompra"
                          type="number"
                          step="0.50"
                          min="0"
                          value={formData.precioCompra}
                          onChange={(e) => setFormData((prev) => ({ ...prev, precioCompra: e.target.value }))}
                          placeholder="0.00"
                          className="pl-7 h-9"
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="precioVentaBase" className="text-xs">
                        Precio de Venta <span className="text-error">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                        <Input
                          id="precioVentaBase"
                          type="number"
                          step="0.50"
                          min="0"
                          required
                          value={formData.precioVentaBase}
                          onChange={(e) => setFormData((prev) => ({ ...prev, precioVentaBase: e.target.value }))}
                          placeholder="0.00"
                          className="pl-7 h-9"
                        />
                      </div>
                    </div>
                  </div>
                  {margen !== null && (
                    <div className="flex flex-col gap-1 mt-2">
                      <div
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                          margen >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                        }`}
                      >
                        <span>
                          Ganancia de $
                          {(
                            parseFloat(formData.precioVentaBase || '0') - parseFloat(formData.precioCompra || '0')
                          ).toFixed(2)}{' '}
                          por unidad
                        </span>
                        <span className="font-bold">Margen: {margen.toFixed(1)}%</span>
                      </div>
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <p className="text-[11px] text-on-surface-variant/80 text-right px-1 mt-0.5 cursor-help inline-flex items-center justify-end gap-1 w-full">
                              <span className="border-b border-dashed border-on-surface-variant/40">¿Cómo se calcula el margen?</span>
                              <span className="material-symbols-outlined !text-[14px]">info</span>
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px] p-3 space-y-2">
                            <p className="font-semibold text-sm">Margen sobre el Costo (Markup)</p>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                              Representa qué porcentaje del costo has añadido como ganancia.
                            </p>
                            <div className="bg-surface-variant/30 p-2 rounded text-xs font-mono text-center">
                              ((Venta - Costo) / Costo) × 100
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  {esGranelAuto && (
                    <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined !text-[16px] text-primary mt-0.5">info</span>
                      <p className="text-xs text-primary">Se venderá a granel — el cajero podrá ingresar cantidades decimales.</p>
                    </div>
                  )}
                </div>

                {/* --- Control de inventario --- */}
                <div className={`rounded-xl border p-4 space-y-3 transition-colors ${formData.manejaInventario && !formData.tieneCaducidad ? 'border-warning/60 bg-warning/5' : 'border-outline/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined !text-[18px] text-primary">inventory_2</span>
                      <p className="text-sm font-semibold text-primary">Control de inventario</p>
                    </div>
                    {formData.manejaInventario && !formData.tieneCaducidad && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30 font-medium">
                        Revisar caducidad
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface">Llevar inventario</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Descuenta stock al vender. Apágalo para servicios o bajo demanda.
                      </p>
                    </div>
                    <Switch
                      checked={formData.manejaInventario}
                      onCheckedChange={(checked: boolean) =>
                        setFormData((prev) => ({
                          ...prev,
                          manejaInventario: checked,
                          tieneCaducidad: checked ? prev.tieneCaducidad : false,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-on-surface">Tiene caducidad</p>
                        <TooltipProvider>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span className="material-symbols-outlined !text-[14px] text-on-surface-variant cursor-help">info</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px] p-3">
                              <p className="text-xs text-on-surface-variant leading-relaxed">
                                Si se activa, la fecha de caducidad sera obligatoria al recibir mercancía de este producto. Los productos sin caducidad igual llevan trazabilidad por lote.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Requiere fecha de vencimiento al recibir mercancía.
                      </p>
                    </div>
                    <Switch
                      checked={formData.tieneCaducidad}
                      disabled={!formData.manejaInventario}
                      onCheckedChange={(checked: boolean) =>
                        setFormData((prev) => ({ ...prev, tieneCaducidad: checked }))
                      }
                    />
                  </div>

                  {formData.manejaInventario && !formData.tieneCaducidad && (
                    <div className="flex items-start gap-2 bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined !text-[16px] text-warning mt-0.5">tips_and_updates</span>
                      <p className="text-xs text-warning">
                        ¿Es un producto perecedero? Activa <strong>Tiene caducidad</strong> para que el sistema exija fecha de vencimiento al recibir mercancía y priorice lotes por FEFO.
                      </p>
                    </div>
                  )}

                  {formData.tieneCaducidad && (
                    <div className="grid gap-2 pt-1">
                      <Label className="text-xs">Rotación al vender</Label>
                      <Select
                        value={formData.metodoRotacion}
                        onValueChange={(v: string) =>
                          setFormData((prev) => ({
                            ...prev,
                            metodoRotacion: (v === 'FIFO' ? 'FIFO' : 'FEFO') as 'FIFO' | 'FEFO',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FEFO">
                            FEFO — Primero vence, primero se vende (recomendado)
                          </SelectItem>
                          <SelectItem value="FIFO">
                            FIFO — Primero entra, primero se vende
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-on-surface-variant">
                        FEFO prioriza los lotes con menor fecha de caducidad para evitar pérdidas.
                      </p>
                    </div>
                  )}
                </div>

                {/* --- Precios Adicionales --- */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                      Presentaciones adicionales ({unidadSeleccionada?.titulo || 'Unidad'})
                    </p>
                  </div>

                  {tiposPrecioDisponibles.map((tipo) => {
                    const precioExistente = preciosAdicionales.find((p) => p.tipo === tipo.valor);
                    const estaActivo = precioExistente?.activo || false;
                    const margenAd = precioExistente ? calcularMargenPrecio(precioExistente.precio, precioExistente.cantidadMinima) : null;
                    return (
                      <div
                        key={tipo.valor}
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: estaActivo ? tipo.color + '60' : undefined }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (estaActivo) {
                              setPreciosAdicionales((prev) => prev.filter((p) => p.tipo !== tipo.valor));
                            } else {
                              setPreciosAdicionales((prev) => [
                                ...prev.filter((p) => p.tipo !== tipo.valor),
                                {
                                  id: `${tipo.valor}-${Date.now()}`,
                                  tipo: tipo.valor,
                                  nombreAlternativo: tipo.defaultNombre || tipo.label,
                                  cantidadMinima: tipo.defaultCant || '',
                                  precio: '',
                                  activo: true,
                                },
                              ]);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-variant/30"
                          style={{ backgroundColor: estaActivo ? tipo.color + '0D' : 'transparent' }}
                        >
                          <span
                            className="material-symbols-outlined !text-[20px] flex-shrink-0"
                            style={{ color: estaActivo ? tipo.color : 'var(--on-surface-variant)' }}
                          >
                            {tipo.icono}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: estaActivo ? tipo.color : 'var(--on-surface)' }}>
                              {tipo.label}
                            </p>
                            <p className="text-xs text-on-surface-variant truncate">{tipo.desc}</p>
                          </div>
                          {estaActivo && margenAd !== null && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: margenAd >= 0 ? '#10b98120' : '#ef444420',
                                color: margenAd >= 0 ? '#059669' : '#dc2626',
                              }}
                            >
                              {margenAd.toFixed(1)}%
                            </span>
                          )}
                          {estaActivo ? (
                            <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: tipo.color }} />
                          ) : (
                            <ChevronDown className="w-4 h-4 flex-shrink-0 text-on-surface-variant" />
                          )}
                        </button>
                        {estaActivo && precioExistente && (
                          <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: tipo.color + '30' }}>
                            <div className="grid grid-cols-3 gap-3 pt-3">
                              <div className="grid gap-1.5">
                                <Label className="text-xs">Nombre en caja</Label>
                                <Input
                                  value={precioExistente.nombreAlternativo}
                                  onChange={(e) =>
                                    setPreciosAdicionales((prev) =>
                                      prev.map((p) => (p.tipo === tipo.valor ? { ...p, nombreAlternativo: e.target.value } : p))
                                    )
                                  }
                                  placeholder={`Ej: ${tipo.defaultNombre}`}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-xs">
                                  Cant. mínima ({unidadSeleccionada?.titulo.split(' ')[0] || 'unid'})
                                </Label>
                                <Input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  value={precioExistente.cantidadMinima}
                                  onChange={(e) =>
                                    setPreciosAdicionales((prev) =>
                                      prev.map((p) => (p.tipo === tipo.valor ? { ...p, cantidadMinima: e.target.value } : p))
                                    )
                                  }
                                  placeholder={tipo.defaultCant}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-xs">
                                  Precio total <span className="text-error">*</span>
                                </Label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs">$</span>
                                  <Input
                                    type="number"
                                    step="0.50"
                                    min="0"
                                    value={precioExistente.precio}
                                    onChange={(e) =>
                                      setPreciosAdicionales((prev) =>
                                        prev.map((p) => (p.tipo === tipo.valor ? { ...p, precio: e.target.value } : p))
                                      )
                                    }
                                    placeholder="0.00"
                                    className="h-9 text-sm pl-6"
                                  />
                                </div>
                              </div>
                            </div>
                            {margenAd !== null && (
                              <div className="flex flex-col gap-1 mt-3">
                                <div
                                  className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg font-medium"
                                  style={{
                                    backgroundColor: margenAd >= 0 ? '#10b98115' : '#ef444415',
                                    color: margenAd >= 0 ? '#059669' : '#dc2626',
                                  }}
                                >
                                  <span>
                                    Ganancia de $
                                    {(
                                      parseFloat(precioExistente.precio || '0') - (parseFloat(formData.precioCompra || '0') * (parseFloat(String(precioExistente.cantidadMinima)) || 1))
                                    ).toFixed(2)}{' '}
                                    vs costo total
                                  </span>
                                  <span className="font-bold">Margen: {margenAd.toFixed(1)}%</span>
                                </div>
                                <TooltipProvider>
                                  <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                      <p className="text-[10px] text-on-surface-variant/70 text-right px-1 cursor-help inline-flex items-center justify-end gap-1 w-full mt-1">
                                        <span className="border-b border-dashed border-on-surface-variant/40">Fórmula</span>
                                        <span className="material-symbols-outlined !text-[12px]">info</span>
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[220px] p-2 space-y-1.5">
                                      <p className="text-xs">
                                        Calculado sobre el <strong>Costo Total</strong> del paquete ({precioExistente.cantidadMinima} unidades × Costo Unitario).
                                      </p>
                                      <div className="bg-surface-variant/30 p-1.5 rounded text-[10px] font-mono text-center">
                                        ((Venta - Costo) / Costo) × 100
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ---- Pie fijo ---- */}
          <div className="px-6 py-4 border-t border-outline/10 flex items-center gap-2 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={onClose} className="mr-auto">
              Cancelar
            </Button>
            {paso > 1 && (
              <Button type="button" variant="outline" onClick={() => setPaso((p) => p - 1)}>
                ← Atrás
              </Button>
            )}
            {paso < 3 ? (
              <Button
                type="button"
                disabled={paso === 1 ? !puedeAvanzarPaso1 : !puedeAvanzarPaso2}
                onClick={(e) => {
                  if (e.detail > 1) return; // Previene doble clic que salte pasos
                  setPaso((p) => p + 1);
                }}
              >
                Siguiente →
              </Button>
            ) : (
              <Button 
                type="button" 
                disabled={isSubmitting || !puedeGuardar}
                onClick={(e) => {
                  if (e.detail > 1) return; // Previene doble clic que dispare submit múltiple
                  ejecutarGuardado();
                }}
              >
                {isSubmitting
                  ? 'Guardando...'
                  : editingProduct
                  ? 'Actualizar Producto'
                  : 'Registrar Producto'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});
