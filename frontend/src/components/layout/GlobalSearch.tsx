import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useThemeStore } from '@/store/useThemeStore';
import { useAuthStore } from '@/store/useAuthStore';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ResultadoProducto {
  id: string;
  nombre: string;
  codigoBarras: string;
  codigoInterno?: string | null;
  precioVentaBase: number;
  unidadMedida?: string | null;
}

interface ResultadoCategoria {
  id: string;
  nombre: string;
  _count?: { productos: number };
}

interface ResultadoUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface AccionBusqueda {
  titulo: string;
  descripcion: string;
  icono: string;
  ruta: string;
  roles?: string[];
  palabras: string;
}

interface ComandoBusqueda {
  titulo: string;
  descripcion: string;
  icono: string;
  palabras: string;
  atajo?: string;
  color: string;
  ejecutar: () => void;
}

type ItemBusqueda =
  | { tipo: 'accion'; accion: AccionBusqueda }
  | { tipo: 'comando'; comando: ComandoBusqueda }
  | { tipo: 'producto'; dato: ResultadoProducto }
  | { tipo: 'categoria'; dato: ResultadoCategoria }
  | { tipo: 'usuario'; dato: ResultadoUsuario };

// ─── Accesos rápidos (acciones de navegación) ────────────────────────────────

const ACCIONES: AccionBusqueda[] = [
  {
    titulo: 'Ventas (POS)',
    descripcion: 'Terminal de punto de venta',
    icono: 'point_of_sale',
    ruta: '/pos',
    palabras: 'pos ventas punto venta caja cobrar ticket cassa',
  },
  {
    titulo: 'Dashboard',
    descripcion: 'Panel de control y resumen ejecutivo',
    icono: 'dashboard',
    ruta: '/',
    palabras: 'inicio panel dashboard principal resumen metricas',
  },
  {
    titulo: 'Presupuestos (Cotizaciones)',
    descripcion: 'Gestión e impresión de cotizaciones y presupuestos',
    icono: 'request_quote',
    ruta: '/presupuestos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO'],
    palabras: 'presupuesto presupuestos cotizacion cotizaciones ticket borrador proforma estimacion',
  },
  {
    titulo: 'Clientes y Lealtad',
    descripcion: 'Directorio de clientes, puntos y historial',
    icono: 'group',
    ruta: '/clientes',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO'],
    palabras: 'cliente clientes directorio lealtad puntos creditos comprador',
  },
  {
    titulo: 'Cuentas por Cobrar (Fiados)',
    descripcion: 'Gestión de fiados y abonos de crédito',
    icono: 'credit_score',
    ruta: '/fiados',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO'],
    palabras: 'fiados fiado cuenta por cobrar saldo deudas abonos credito pagar',
  },
  {
    titulo: 'Productos',
    descripcion: 'Catálogo general de productos',
    icono: 'inventory_2',
    ruta: '/admin/productos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR'],
    palabras: 'producto productos catalogo articulo precio codigo barra sku',
  },
  {
    titulo: 'Categorías',
    descripcion: 'Clasificación de productos',
    icono: 'category',
    ruta: '/admin/categorias',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR'],
    palabras: 'categoria categorias catalogo clasificacion familias departamento',
  },
  {
    titulo: 'Inventario y Existencias',
    descripcion: 'Control de stock, movimientos y kardex',
    icono: 'warehouse',
    ruta: '/admin/inventario',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR'],
    palabras: 'inventario stock existencias almacen movimientos ajuste entrada salida kardex',
  },
  {
    titulo: 'Control de Lotes',
    descripcion: 'Gestión de lotes y fechas de caducidad',
    icono: 'inventory',
    ruta: '/admin/lotes',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR'],
    palabras: 'lotes lote caducidad vencimiento fecha expiracion stock percedero',
  },
  {
    titulo: 'Proveedores',
    descripcion: 'Directorio de proveedores y marcas',
    icono: 'local_shipping',
    ruta: '/admin/proveedores',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'ALMACEN'],
    palabras: 'proveedores proveedor compras distribuidor marcas surtido abastecimiento',
  },
  {
    titulo: 'Solicitud a Proveedores (Requisiciones)',
    descripcion: 'Generar órdenes de compra y requisiciones de surtido a proveedores',
    icono: 'request_quote',
    ruta: '/admin/solicitudes-proveedor',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'ALMACEN', 'CAJERO'],
    palabras: 'solicitud solicitudes proveedor proveedores requisicion requisiciones orden de compra ordenes surtido pedido abastecimiento compra',
  },
  {
    titulo: 'Control de Cajas',
    descripcion: 'Gestión de terminales de caja y turnos',
    icono: 'savings',
    ruta: '/admin/cajas',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'],
    palabras: 'cajas caja arcas turnos aperturas cortes z arqueos terminales efectivo',
  },
  {
    titulo: 'Cupones de Descuento',
    descripcion: 'Administración de cupones y promociones',
    icono: 'local_offer',
    ruta: '/admin/cupones',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'],
    palabras: 'cupon cupones descuento promociones codigo cuponera rebaja',
  },
  {
    titulo: 'Combos y Paquetes',
    descripcion: 'Paquetes promocionales y combos de productos',
    icono: 'package_2',
    ruta: '/admin/combos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'],
    palabras: 'combo combos paquetes promocionales oferta kit conjunto especial',
  },
  {
    titulo: 'Devoluciones',
    descripcion: 'Registrar devoluciones y notas de crédito por folio',
    icono: 'assignment_return',
    ruta: '/admin/devoluciones',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CAJERO'],
    palabras: 'devolucion devolver ticket folio reembolso cambio nota credito',
  },
  {
    titulo: 'Reportes y Métricas',
    descripcion: 'Informes de ventas, utilidades y análisis',
    icono: 'analytics',
    ruta: '/reportes',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'CONTADOR'],
    palabras: 'reportes reportes analitica metricas graficas estadisticas utilidades ganancias ventas exportar excel pdf',
  },
  {
    titulo: 'Usuarios y Roles',
    descripcion: 'Gestión de usuarios, cajeros y permisos RBAC',
    icono: 'manage_accounts',
    ruta: '/admin/usuarios',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'],
    palabras: 'usuario usuarios empleados personal rol cuenta contraseña acceso cajero administrador',
  },
  {
    titulo: 'Auditoría y Bitácora',
    descripcion: 'Histórico de actividad y logs del sistema',
    icono: 'history',
    ruta: '/admin/auditoria',
    roles: ['SUPER_ADMIN', 'ADMIN', 'GERENTE'],
    palabras: 'auditoria historial actividad registro logs bitacora auditoria seguimiento eventos',
  },
  {
    titulo: 'Configuración del Sitio',
    descripcion: 'Ajustes del sitio, marca, lealtad, tickets y caja',
    icono: 'settings',
    ruta: '/admin/configuracion',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    palabras: 'configuracion ajustes sitio empresa corte umbral tickets lealtad logo branding',
  },
  {
    titulo: 'Mi Perfil',
    descripcion: 'Ver y editar mi información de usuario',
    icono: 'person',
    ruta: '/admin/perfil',
    palabras: 'perfil usuario cuenta datos contraseña mi cuenta',
  },
];

const ROL_USUARIO_ADMIN = ['SUPER_ADMIN', 'ADMIN', 'GERENTE'];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function coincide(texto: string, termino: string): boolean {
  return normalizar(texto).includes(normalizar(termino));
}

// ─── Buscador Global ─────────────────────────────────────────────────────────

export default function GlobalSearch({
  onToggleSidebar,
  onShowAtajos,
}: {
  onToggleSidebar: () => void;
  onShowAtajos: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const peticionRef = useRef(0);

  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const logout = useAuthStore((s) => s.logout);

  const [termino, setTermino] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isBuscando, setIsBuscando] = useState(false);
  const [indice, setIndice] = useState(0);
  const [productos, setProductos] = useState<ResultadoProducto[]>([]);
  const [categorias, setCategorias] = useState<ResultadoCategoria[]>([]);
  const [usuarios, setUsuarios] = useState<ResultadoUsuario[]>([]);

  const rolUsuario = useMemo(() => {
    const guardado = localStorage.getItem('cudii_user');
    if (!guardado) return undefined;
    try {
      const parsed = JSON.parse(guardado) as { rol?: string };
      return parsed.rol;
    } catch {
      return undefined;
    }
  }, []);

  const accesible = useCallback(
    (accion: AccionBusqueda): boolean =>
      !accion.roles || !rolUsuario || accion.roles.includes(rolUsuario),
    [rolUsuario],
  );

  const accionesVisibles = useMemo(
    () => ACCIONES.filter((a) => accesible(a)),
    [accesible],
  );

  const comandos = useMemo<ComandoBusqueda[]>(
    () => [
      {
        titulo: isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
        descripcion: 'Alternar entre tema claro y oscuro',
        icono: isDarkMode ? 'light_mode' : 'dark_mode',
        palabras: 'tema claro oscuro modo color apariencia',
        atajo: 'Alt T',
        color: 'bg-warning/10 text-warning',
        ejecutar: toggleDarkMode,
      },
      {
        titulo: 'Mostrar u ocultar menú lateral',
        descripcion: 'Minimizar o expandir la barra lateral',
        icono: 'menu_open',
        palabras: 'sidebar lateral menu barra minimizar expandir panel',
        atajo: 'Ctrl Alt B',
        color: 'bg-surface-container-low text-on-surface-variant',
        ejecutar: onToggleSidebar,
      },
      {
        titulo: 'Cerrar sesión',
        descripcion: 'Salir de Cudii',
        icono: 'logout',
        palabras: 'salir cerrar sesion logout salida',
        color: 'bg-error/10 text-error',
        ejecutar: logout,
      },
      {
        titulo: 'Ver atajos de teclado',
        descripcion: 'Mostrar la lista de atajos disponibles',
        icono: 'keyboard',
        palabras: 'atajos teclado shortcuts ayuda consultar',
        atajo: 'Ctrl /',
        color: 'bg-surface-container-low text-on-surface-variant',
        ejecutar: onShowAtajos,
      },
    ],
    [isDarkMode, toggleDarkMode, onToggleSidebar, logout, onShowAtajos],
  );

  // Cerrar al navegar
  useEffect(() => {
    setIsOpen(false);
    setTermino('');
  }, [location.pathname, location.search]);

  // Atajos de teclado globales
  useEffect(() => {
    const manejarAtajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        return;
      }
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleSidebar();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '/' || e.code === 'Slash')
      ) {
        e.preventDefault();
        onShowAtajos();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleDarkMode();
      }
    };
    window.addEventListener('keydown', manejarAtajo);
    return () => window.removeEventListener('keydown', manejarAtajo);
  }, [onToggleSidebar, toggleDarkMode, onShowAtajos]);

  // Búsqueda de entidades con debounce
  useEffect(() => {
    const q = termino.trim();
    if (!q) {
      peticionRef.current += 1;
      setProductos([]);
      setCategorias([]);
      setUsuarios([]);
      setIsBuscando(false);
      return;
    }

    setIsBuscando(true);
    const peticion = ++peticionRef.current;

    const espera = setTimeout(async () => {
      const puedeUsuarios =
        !rolUsuario || ROL_USUARIO_ADMIN.includes(rolUsuario);

      const [prod, cat, usr] = await Promise.all([
        api
          .get<ResultadoProducto[]>('/products/search', {
            params: { q, limit: 5 },
          })
          .catch(() => []),
        api
          .get<{ data: ResultadoCategoria[] }>('/categories', {
            params: { search: q, limit: 5 },
          })
          .catch(() => ({ data: [] })),
        puedeUsuarios
          ? api
              .get<{ data: ResultadoUsuario[] }>('/users', {
                params: { search: q, limit: 5 },
              })
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      if (peticion !== peticionRef.current) return;

      setProductos(prod.data ?? prod);
      setCategorias(cat.data?.data ?? []);
      setUsuarios(usr.data?.data ?? []);
      setIsBuscando(false);
    }, 250);

    return () => clearTimeout(espera);
  }, [termino, rolUsuario]);

  // Lista plana de items seleccionables
  const items = useMemo<ItemBusqueda[]>(() => {
    const lista: ItemBusqueda[] = [];
    const q = termino.trim().toLowerCase();

    if (q) {
      productos.forEach((p) => lista.push({ tipo: 'producto', dato: p }));
      categorias.forEach((c) => lista.push({ tipo: 'categoria', dato: c }));
      usuarios.forEach((u) => lista.push({ tipo: 'usuario', dato: u }));
      accionesVisibles
        .filter((a) => coincide(a.titulo + ' ' + a.palabras, q))
        .forEach((a) => lista.push({ tipo: 'accion', accion: a }));
      comandos
        .filter((c) => coincide(c.titulo + ' ' + c.palabras, q))
        .forEach((c) => lista.push({ tipo: 'comando', comando: c }));
    } else {
      accionesVisibles.forEach((a) => lista.push({ tipo: 'accion', accion: a }));
      comandos.forEach((c) => lista.push({ tipo: 'comando', comando: c }));
    }

    return lista;
  }, [termino, productos, categorias, usuarios, accionesVisibles, comandos]);

  useEffect(() => {
    setIndice(0);
  }, [items.length, termino]);

  const cerrar = useCallback(() => {
    setIsOpen(false);
    inputRef.current?.blur();
  }, []);

  const seleccionar = useCallback(
    (item: ItemBusqueda) => {
      cerrar();
      setTermino('');
      if (item.tipo === 'comando') {
        item.comando.ejecutar();
        return;
      }
      if (item.tipo === 'accion') {
        navigate(item.accion.ruta);
        return;
      }
      if (item.tipo === 'producto') {
        navigate(`/admin/productos?q=${encodeURIComponent(termino.trim())}`);
        return;
      }
      if (item.tipo === 'categoria') {
        navigate('/admin/categorias');
        return;
      }
      navigate('/admin/usuarios');
    },
    [cerrar, navigate, termino],
  );

  const manejarTecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      cerrar();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setIndice((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) =>
        items.length === 0 ? 0 : (i - 1 + items.length) % items.length,
      );
      return;
    }
    if (e.key === 'Enter') {
      if (items[indice]) {
        e.preventDefault();
        seleccionar(items[indice]);
      }
      return;
    }
    if (/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ]$/.test(e.key)) {
      setIsOpen(true);
    }
  };

  const mostrarVacios = !isBuscando && termino.trim() && items.length === 0;

  return (
    <div className="relative w-full max-w-md hidden sm:block">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline !text-xl pointer-events-none">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        value={termino}
        placeholder="Buscar en Cudii..."
        title="Buscar en Cudii (Ctrl + K)"
        onFocus={() => setIsOpen(true)}
        onChange={(e) => setTermino(e.target.value)}
        onKeyDown={manejarTecla}
        className="w-full bg-on-surface/5 border border-transparent rounded-full py-3 pl-12 pr-16 text-sm focus:border-on-surface/20 focus:bg-on-surface/10 transition-colors text-on-surface outline-none"
        aria-label="Buscar en Cudii"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-outline/70 font-label-sm pointer-events-none hidden md:inline">
        Ctrl K
      </span>

      {isOpen && (
        <>
          {/* Backdrop para cerrar al hacer clic fuera */}
          <div className="fixed inset-0 z-40" onClick={cerrar} />
          <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-outline/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-[420px] overflow-y-auto custom-scrollbar py-2">
              {termino.trim() ? (
                <>
                  {productos.length > 0 && (
                    <GrupoSeccion titulo="Productos">
                      {productos.map((p) => (
                        <ItemGlobal
                          key={`p-${p.id}`}
                          activo={items.findIndex(
                            (it) =>
                              it.tipo === 'producto' && it.dato.id === p.id,
                          ) === indice}
                          icono="inventory_2"
                          color="bg-primary/10 text-primary"
                          titulo={p.nombre}
                          subtexto={`$${Number(p.precioVentaBase).toFixed(2)} · ${
                            p.codigoInterno || p.codigoBarras
                          }${p.unidadMedida ? ` · ${p.unidadMedida}` : ''}`}
                          onClick={() =>
                            seleccionar({
                              tipo: 'producto',
                              dato: p,
                            })
                          }
                        />
                      ))}
                    </GrupoSeccion>
                  )}

                  {categorias.length > 0 && (
                    <GrupoSeccion titulo="Categorías">
                      {categorias.map((c) => (
                        <ItemGlobal
                          key={`c-${c.id}`}
                          activo={
                            items.findIndex(
                              (it) =>
                                it.tipo === 'categoria' &&
                                it.dato.id === c.id,
                            ) === indice
                          }
                          icono="category"
                          color="bg-warning/10 text-warning"
                          titulo={c.nombre}
                          subtexto={`${c._count?.productos ?? 0} productos`}
                          onClick={() =>
                            seleccionar({ tipo: 'categoria', dato: c })
                          }
                        />
                      ))}
                    </GrupoSeccion>
                  )}

                  {usuarios.length > 0 && (
                    <GrupoSeccion titulo="Usuarios">
                      {usuarios.map((u) => (
                        <ItemGlobal
                          key={`u-${u.id}`}
                          activo={
                            items.findIndex(
                              (it) =>
                                it.tipo === 'usuario' && it.dato.id === u.id,
                            ) === indice
                          }
                          icono="group"
                          color="bg-success/10 text-success"
                          titulo={u.nombre}
                          subtexto={`${u.rol.replace('_', ' ').toLowerCase()} · ${u.email}`}
                          onClick={() =>
                            seleccionar({ tipo: 'usuario', dato: u })
                          }
                        />
                      ))}
                    </GrupoSeccion>
                  )}

                  {items.some((it) => it.tipo === 'accion') && (
                    <GrupoSeccion titulo="Ir a...">
                      {items
                        .filter((it): it is { tipo: 'accion'; accion: AccionBusqueda } => it.tipo === 'accion')
                        .map((it) => (
                          <ItemGlobal
                            key={`a-${it.accion.ruta}`}
                            activo={indice === items.indexOf(it)}
                            icono={it.accion.icono}
                            color="bg-surface-container-low text-on-surface-variant"
                            titulo={it.accion.titulo}
                            subtexto={it.accion.descripcion}
                            onClick={() => seleccionar(it)}
                          />
                        ))}
                    </GrupoSeccion>
                  )}

                  {items.some((it) => it.tipo === 'comando') && (
                    <GrupoSeccion titulo="Comandos">
                      {items
                        .filter((it): it is { tipo: 'comando'; comando: ComandoBusqueda } => it.tipo === 'comando')
                        .map((it) => (
                          <ItemGlobal
                            key={`c-${it.comando.titulo}`}
                            activo={indice === items.indexOf(it)}
                            icono={it.comando.icono}
                            color={it.comando.color}
                            titulo={it.comando.titulo}
                            subtexto={it.comando.descripcion}
                            atajo={it.comando.atajo}
                            onClick={() => seleccionar(it)}
                          />
                        ))}
                    </GrupoSeccion>
                  )}
                </>
              ) : (
                <>
                  <GrupoSeccion titulo="Accesos rápidos">
                    {items.map((it, i) =>
                      it.tipo === 'accion' ? (
                        <ItemGlobal
                          key={`a-${it.accion.ruta}`}
                          activo={i === indice}
                          icono={it.accion.icono}
                          color="bg-surface-container-low text-on-surface-variant"
                          titulo={it.accion.titulo}
                          subtexto={it.accion.descripcion}
                          onClick={() => seleccionar(it)}
                        />
                      ) : null,
                    )}
                  </GrupoSeccion>
                  <GrupoSeccion titulo="Comandos">
                    {items.map((it, i) =>
                      it.tipo === 'comando' ? (
                        <ItemGlobal
                          key={`c-${it.comando.titulo}`}
                          activo={i === indice}
                          icono={it.comando.icono}
                          color={it.comando.color}
                          titulo={it.comando.titulo}
                          subtexto={it.comando.descripcion}
                          atajo={it.comando.atajo}
                          onClick={() => seleccionar(it)}
                        />
                      ) : null,
                    )}
                  </GrupoSeccion>
                </>
              )}

              {isBuscando && (
                <div className="flex items-center justify-center gap-2 py-8 text-outline">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-label-sm">Buscando...</span>
                </div>
              )}

              {mostrarVacios && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-outline px-6 text-center">
                  <span className="material-symbols-outlined !text-3xl">
                    search_off
                  </span>
                  <p className="text-xs font-headline-md font-semibold text-on-surface-variant">
                    Sin resultados para "{termino.trim()}"
                  </p>
                  <p className="text-[11px] font-label-sm text-outline">
                    Revisa la ortografía o prueba con otra palabra.
                  </p>
                </div>
              )}
            </div>

            {/* Barra de ayuda de teclado */}
            <div className="border-t border-outline/10 px-4 py-2 flex items-center gap-3 text-[10px] font-label-sm text-outline">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-outline/30 bg-on-surface/5 font-label-sm">↑</kbd>
                <kbd className="px-1 py-0.5 rounded border border-outline/30 bg-on-surface/5 font-label-sm">↓</kbd>
                Navegar
              </span>
              <span>Enter abrir</span>
              <span>Esc cerrar</span>
              <span className="ml-auto hidden md:inline">Ctrl K buscar · Ctrl / atajos</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Subcomponentes de presentación ──────────────────────────────────────────

function GrupoSeccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-4 pt-2 pb-1 text-[10px] font-label-sm font-semibold uppercase tracking-widest text-outline">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function ItemGlobal({
  activo,
  icono,
  color,
  titulo,
  subtexto,
  atajo,
  onClick,
}: {
  activo: boolean;
  icono: string;
  color: string;
  titulo: string;
  subtexto: string;
  atajo?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
        activo ? 'bg-primary/10' : 'hover:bg-on-surface/5'
      }`}
    >
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}
      >
        <span className="material-symbols-outlined !text-lg">{icono}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-headline-md font-semibold text-on-surface truncate">
          {titulo}
        </span>
        <span className="block text-[11px] font-label-sm text-outline truncate">
          {subtexto}
        </span>
      </span>
      {atajo && (
        <span className="hidden md:inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded-md border border-outline/20 bg-on-surface/5 text-[10px] font-label-sm text-outline">
          {atajo}
        </span>
      )}
    </button>
  );
}
