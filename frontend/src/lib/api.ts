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
