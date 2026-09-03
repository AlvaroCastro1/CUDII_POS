import axios from 'axios';

// Instancia global de Axios para toda la aplicación
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar el Token JWT en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cudii_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor para atrapar 401 Unauthorized de forma global
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    // Si expira o es inválido, limpiamos sesión. 
    // Evitamos redirecciones aquí directas por si es un error puntual,
    // el AuthStore se encargará de esto a través de listeners o llamadas directas.
    localStorage.removeItem('cudii_token');
    localStorage.removeItem('cudii_user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

/**
 * Extrae un mensaje legible de un error desconocido de Axios.
 * @param err Error capturado en un bloque catch.
 * @param fallback Mensaje por defecto si no se puede extraer uno.
 * @returns Mensaje de error para mostrar al usuario.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg[0] || fallback;
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

/**
 * Convierte una URL relativa de recurso estático (ej: /uploads/logos/...)
 * en una URL absoluta respaldada por la baseURL del backend.
 */
export function obtenerUrlImagen(url?: string | null): string {
  if (!url || !url.trim()) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}
