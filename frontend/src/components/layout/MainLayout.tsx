import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';

export default function MainLayout() {
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDarkMode = useThemeStore(state => state.isDarkMode);
  const toggleDarkMode = useThemeStore(state => state.toggleDarkMode);

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md selection:bg-primary selection:text-on-primary transition-colors duration-300 ease-in-out flex h-screen overflow-hidden">

      {/* Mobile Backdrop: visible solo en móvil cuando el menú está abierto */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/*
        ASIDE — Forma parte del flujo flex en desktop (md:relative md:flex).
        En móvil es fixed + translate para el efecto drawer.
        De esta forma, el <main> NO necesita margin-left y nunca aparece una franja.
      */}
      <aside className={`
        fixed md:relative
        top-0 left-0
        h-screen
        shrink-0
        bg-surface border-r border-on-surface/10
        z-50 md:z-auto
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-72' : 'w-72 md:w-20'}
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="h-24 flex items-center shrink-0 pl-6">
          <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined !text-xl">auto_awesome</span>
          </div>
          <span className={`font-display-lg text-2xl tracking-tight text-on-surface whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-4 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
            Cudii
          </span>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden mt-4 scrollbar-hide flex flex-col gap-6">
          <div className="px-4">
            <h3 className={`font-label-sm text-[10px] text-outline uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 mb-3 px-4 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:mb-0 md:px-0 md:h-0'}`}>
              Panel de Control
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}
                className={`nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 animate-hover animate-press pl-[14px] ${location.pathname === '/' ? 'bg-primary text-on-primary font-medium' : 'text-on-surface-variant hover:bg-on-surface/5'}`}
                title={!isSidebarOpen ? 'Dashboard' : ''}
              >
                <span className="material-symbols-outlined !text-xl shrink-0">dashboard</span>
                <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                  Dashboard
                </span>
              </button>
            </div>
          </div>

          <div className="px-4">
            <h3 className={`font-label-sm text-[10px] text-outline uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 mb-3 px-4 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:mb-0 md:px-0 md:h-0'}`}>
              Operaciones
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => { navigate('/pos'); setIsMobileMenuOpen(false); }}
                className={`nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 animate-hover animate-press pl-[14px] ${location.pathname === '/pos' ? 'bg-primary text-on-primary font-medium' : 'text-on-surface-variant hover:bg-on-surface/5'}`}
                title={!isSidebarOpen ? 'Ventas (POS)' : ''}
              >
                <span className="material-symbols-outlined !text-xl shrink-0">point_of_sale</span>
                <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                  Ventas (POS)
                </span>
              </button>
              <button
                className="nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 text-on-surface-variant hover:bg-on-surface/5 animate-hover animate-press pl-[14px]"
                title={!isSidebarOpen ? 'Pedidos' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined !text-xl shrink-0">receipt_long</span>
                <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                  Pedidos
                </span>
              </button>
            </div>
          </div>

          {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN' || user?.rol === 'GERENTE') && (
            <div className="px-4">
              <h3 className={`font-label-sm text-[10px] text-outline uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 mb-3 px-4 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:mb-0 md:px-0 md:h-0'}`}>
                Catálogo
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => { navigate('/admin/categorias'); setIsMobileMenuOpen(false); }}
                  className={`nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 animate-hover animate-press pl-[14px] ${location.pathname === '/admin/categorias' ? 'bg-primary text-on-primary font-medium' : 'text-on-surface-variant hover:bg-on-surface/5'}`}
                  title={!isSidebarOpen ? 'Categorías' : ''}
                >
                  <span className="material-symbols-outlined !text-xl shrink-0">category</span>
                  <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                    Categorías
                  </span>
                </button>
                <button
                  onClick={() => { navigate('/admin/productos'); setIsMobileMenuOpen(false); }}
                  className={`nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 animate-hover animate-press pl-[14px] ${location.pathname === '/admin/productos' ? 'bg-primary text-on-primary font-medium' : 'text-on-surface-variant hover:bg-on-surface/5'}`}
                  title={!isSidebarOpen ? 'Productos' : ''}
                >
                  <span className="material-symbols-outlined !text-xl shrink-0">inventory_2</span>
                  <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                    Productos
                  </span>
                </button>
              </div>
            </div>
          )}

          {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN' || user?.rol === 'GERENTE' || user?.rol === 'ALMACEN') && (
            <div className="px-4">
              <h3 className={`font-label-sm text-[10px] text-outline uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 mb-3 px-4 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:mb-0 md:px-0 md:h-0'}`}>
                Inventario
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => { navigate('/admin/inventario'); setIsMobileMenuOpen(false); }}
                  className={`nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 animate-hover animate-press pl-[14px] ${location.pathname === '/admin/inventario' ? 'bg-primary text-on-primary font-medium' : 'text-on-surface-variant hover:bg-on-surface/5'}`}
                  title={!isSidebarOpen ? 'Inventario' : ''}
                >
                  <span className="material-symbols-outlined !text-xl shrink-0">warehouse</span>
                  <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                    Inventario
                  </span>
                </button>
              </div>
            </div>
          )}

          {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN') && (
            <div className="px-4">
              <h3 className={`font-label-sm text-[10px] text-outline uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 mb-3 px-4 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:mb-0 md:px-0 md:h-0'}`}>
                Administración
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => { navigate('/admin/usuarios'); setIsMobileMenuOpen(false); }}
                  className={`nav-link w-full flex items-center h-11 rounded-xl transition-all duration-300 animate-hover animate-press pl-[14px] ${location.pathname === '/admin/usuarios' ? 'bg-primary text-on-primary font-medium' : 'text-on-surface-variant hover:bg-on-surface/5'}`}
                  title={!isSidebarOpen ? 'Usuarios' : ''}
                >
                  <span className="material-symbols-outlined !text-xl shrink-0">group</span>
                  <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out max-w-[200px] opacity-100 ml-3 ${isSidebarOpen ? '' : 'md:max-w-0 md:opacity-0 md:ml-0'}`}>
                    Usuarios
                  </span>
                </button>
              </div>
            </div>
          )}
        </nav>


        {/* Botón Colapsar — solo en desktop */}
        <div className="p-4 border-t border-on-surface/10 mt-auto hidden md:flex justify-center">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-all"
            title={isSidebarOpen ? 'Colapsar Menú' : 'Expandir Menú'}
          >
            <span
              className="material-symbols-outlined !text-xl transition-transform duration-300"
              style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
            >
              keyboard_double_arrow_left
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN — ocupa el espacio restante, sin margin-left manual */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden relative transition-all duration-300 ease-in-out min-w-0">

        {/* Header */}
        <header className="h-24 border-b border-on-surface/10 flex items-center justify-between px-4 md:px-8 shrink-0 bg-background z-30 transition-colors duration-300 ease-in-out">
          <div className="flex items-center gap-3 md:gap-6 flex-1 max-w-2xl">
            {/* Hamburger — solo en móvil */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-full hover:bg-on-surface/5 text-on-surface transition-colors md:hidden"
            >
              <span className="material-symbols-outlined !text-2xl">menu</span>
            </button>

            <div className="relative w-full max-w-md group hidden sm:block">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline !text-xl group-focus-within:text-on-surface transition-colors">search</span>
              <input
                type="text"
                placeholder="Buscar en Cudii..."
                className="w-full bg-on-surface/5 border border-transparent rounded-full py-3 pl-12 pr-4 text-sm focus:border-on-surface/20 focus:bg-on-surface/10 transition-all text-on-surface outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2.5 rounded-full hover:bg-on-surface/5 text-outline transition-colors relative animate-hover animate-press">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
            </button>

            {/* Toggle Tema "Eclipse" */}
            <button
              onClick={toggleDarkMode}
              className="relative w-16 h-8 rounded-full bg-on-surface/5 border border-on-surface/10 overflow-hidden flex items-center px-1 animate-hover animate-press"
              style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <div
                className="absolute left-1 w-6 h-6 rounded-full bg-on-surface flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.2)] z-10"
                style={{
                  transform: isDarkMode ? 'translateX(32px)' : 'translateX(0)',
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <span className="material-symbols-outlined !text-[14px] text-surface">
                  {isDarkMode ? 'dark_mode' : 'light_mode'}
                </span>
              </div>
              <div className="w-full flex justify-between px-1.5 opacity-40 z-0">
                <span className="material-symbols-outlined !text-[12px] text-on-surface">light_mode</span>
                <span className="material-symbols-outlined !text-[12px] text-on-surface">dark_mode</span>
              </div>
            </button>

            <div className="h-8 w-px bg-on-surface/10 mx-2"></div>

            {/* Perfil */}
            <div className="relative">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-on-surface">{user?.nombre || 'Admin User'}</p>
                  <p className="text-[10px] text-outline tracking-wider uppercase font-bold">PRO PLAN</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface border border-outline/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                  <span className="material-symbols-outlined text-outline">person</span>
                </div>
              </div>

              {/* Menú desplegable de perfil */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-surface border border-outline/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/perfil'); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-colors flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined !text-[18px]">person</span>
                    Ver / Editar mi Perfil
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); logout(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-colors flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined !text-[18px]">logout</span>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenido inyectado por React Router */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
