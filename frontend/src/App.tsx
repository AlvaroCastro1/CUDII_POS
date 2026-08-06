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
import CategoriasView from './views/admin/CategoriasView';
import InventarioView from './views/admin/InventarioView';
import UsuariosView from './views/admin/UsuariosView';
import MiPerfilView from './views/admin/MiPerfilView';

// Componente para proteger rutas privadas
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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
          { path: 'inventario', element: <InventarioView /> },
          { path: 'usuarios', element: <UsuariosView /> },
          { path: 'perfil', element: <MiPerfilView /> },
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
