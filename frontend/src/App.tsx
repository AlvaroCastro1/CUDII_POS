import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';
import { useEffect } from 'react';
import { useThemeStore } from './store/useThemeStore';

// Vistas
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import PosView from './views/PosView';
import OnboardingView from './views/OnboardingView';
import ClientesView from './views/admin/ClientesView';
import FiadosView from './views/FiadosView';
import MainLayout from './components/layout/MainLayout';

// Vistas Admin
import ProductosView from './views/admin/ProductosView';
import ProductoDetalleView from './views/admin/ProductoDetalleView';
import CategoriasView from './views/admin/CategoriasView';
import InventarioView from './views/admin/InventarioView';
import LotesView from './views/admin/LotesView';
import ProveedoresView from './views/admin/ProveedoresView';
import UsuariosView from './views/admin/UsuariosView';
import MiPerfilView from './views/admin/MiPerfilView';
import ConfiguracionView from './views/admin/ConfiguracionView';
import AuditoriaView from './views/admin/AuditoriaView';
import DevolucionesView from './views/DevolucionesView';
import ReportesView from './views/ReportesView';
import VentaDetalleView from './views/admin/VentaDetalleView';
import CajasView from './views/admin/CajasView';
import CuponesView from './views/admin/CuponesView';

// Componente para proteger rutas privadas
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Componente para rutas exclusivas de ADMIN / SUPER_ADMIN
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.rol !== 'SUPER_ADMIN' && user?.rol !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Componente para rutas de gerencia (SUPER_ADMIN / ADMIN / GERENTE)
function GerenciaRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (
    user?.rol !== 'SUPER_ADMIN' &&
    user?.rol !== 'ADMIN' &&
    user?.rol !== 'GERENTE'
  ) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Componente para rutas de análisis (SUPER_ADMIN / ADMIN / GERENTE / CONTADOR)
function AnalisisRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (
    user?.rol !== 'SUPER_ADMIN' &&
    user?.rol !== 'ADMIN' &&
    user?.rol !== 'GERENTE' &&
    user?.rol !== 'CONTADOR'
  ) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Guard genérico por roles. SUPER_ADMIN siempre tiene acceso.
function RequireRol({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol === 'SUPER_ADMIN') return <>{children}</>;
  if (roles.includes(user.rol)) return <>{children}</>;
  return <Navigate to="/" replace />;
}

// Configuración de Rutas base
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginView />,
  },
  {
    path: '/onboarding',
    element: <OnboardingView />,
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardView />,
      },
      {
        path: 'pos',
        element: (
          <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO']}>
            <PosView />
          </RequireRol>
        ),
      },
      {
        path: 'clientes',
        element: (
          <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO']}>
            <ClientesView />
          </RequireRol>
        ),
      },
      {
        path: 'fiados',
        element: (
          <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO']}>
            <FiadosView />
          </RequireRol>
        ),
      },
      {
        path: 'reportes',
        element: (
          <AnalisisRoute>
            <ReportesView />
          </AnalisisRoute>
        ),
      },
      {
        path: 'admin',
        children: [
          {
            path: 'categorias',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR']}>
                <CategoriasView />
              </RequireRol>
            ),
          },
          {
            path: 'productos',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR']}>
                <ProductosView />
              </RequireRol>
            ),
          },
          {
            path: 'productos/:id',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR']}>
                <ProductoDetalleView />
              </RequireRol>
            ),
          },
          {
            path: 'inventario',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR']}>
                <InventarioView />
              </RequireRol>
            ),
          },
          {
            path: 'lotes',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN', 'CONTADOR']}>
                <LotesView />
              </RequireRol>
            ),
          },
          {
            path: 'proveedores',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'ALMACEN']}>
                <ProveedoresView />
              </RequireRol>
            ),
          },
          {
            path: 'usuarios',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE']}>
                <UsuariosView />
              </RequireRol>
            ),
          },
          {
            path: 'cajas',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE']}>
                <CajasView />
              </RequireRol>
            ),
          },
          {
            path: 'cupones',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE']}>
                <CuponesView />
              </RequireRol>
            ),
          },
          { path: 'ventas/:id', element: <VentaDetalleView /> },
          {
            path: 'devoluciones',
            element: (
              <RequireRol roles={['ADMIN', 'GERENTE', 'CAJERO']}>
                <DevolucionesView />
              </RequireRol>
            ),
          },
          { path: 'perfil', element: <MiPerfilView /> },
          {
            path: 'auditoria',
            element: (
              <GerenciaRoute>
                <AuditoriaView />
              </GerenciaRoute>
            ),
          },
          {
            path: 'configuracion',
            element: (
              <AdminRoute>
                <ConfiguracionView />
              </AdminRoute>
            ),
          },
        ]
      }
    ]
  },
]);


function App() {
  // Inicializamos el store de tema para que inyecte la clase "dark" al documento si corresponde
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  useEffect(() => {
    // Sincronizar el classList en montaje inicial
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <>
      <RouterProvider router={router} />
      {/* Sistema de Toasts configurado para el Whitelabel y Dark Mode */}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        theme={isDarkMode ? 'dark' : 'light'}
      />
    </>
  );
}

export default App;
