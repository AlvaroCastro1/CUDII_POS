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
import MainLayout from './components/layout/MainLayout';

// Vistas Admin
import ProductosView from './views/admin/ProductosView';
import ProductoDetalleView from './views/admin/ProductoDetalleView';
import CategoriasView from './views/admin/CategoriasView';
import InventarioView from './views/admin/InventarioView';
import LotesView from './views/admin/LotesView';
import UsuariosView from './views/admin/UsuariosView';
import MiPerfilView from './views/admin/MiPerfilView';
import ConfiguracionView from './views/admin/ConfiguracionView';
import AuditoriaView from './views/admin/AuditoriaView';
import DevolucionesView from './views/DevolucionesView';

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
        element: <PosView />,
      },
      {
        path: 'admin',
        children: [
          { path: 'categorias', element: <CategoriasView /> },
          { path: 'productos', element: <ProductosView /> },
          { path: 'productos/:id', element: <ProductoDetalleView /> },
          { path: 'inventario', element: <InventarioView /> },
          { path: 'lotes', element: <LotesView /> },
          { path: 'usuarios', element: <UsuariosView /> },
          { path: 'devoluciones', element: <DevolucionesView /> },
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
