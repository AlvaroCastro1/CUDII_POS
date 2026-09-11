import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useWhitelabelStore } from '../store/useWhitelabelStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

/**
 * Hook para inicializar y cargar la configuración de Whitelabel del tenant actual.
 * Se debe montar en la raíz de la app autenticada.
 */
export function useWhitelabelInit() {
  const [isInitializing, setIsInitializing] = useState(true);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setWhitelabel = useWhitelabelStore((state) => state.setWhitelabel);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);

  useEffect(() => {
    let mounted = true;

    async function loadWhitelabel() {
      if (!isAuthenticated) {
        setIsInitializing(false);
        return;
      }
      
      try {
        const { data } = await api.get('/company-settings/whitelabel');
        if (mounted && data) {
          setWhitelabel(data);
          
          // Ajustar modo inicial según preferencia del tenant
          if (data.interfaz?.modoPredeterminado === 'light') {
            setDarkMode(false);
          } else if (data.interfaz?.modoPredeterminado === 'dark') {
            setDarkMode(true);
          }
        }
      } catch (error) {
        console.error('Error cargando configuración Whitelabel:', error);
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    loadWhitelabel();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, setWhitelabel, setDarkMode]);

  return { isInitializing };
}
