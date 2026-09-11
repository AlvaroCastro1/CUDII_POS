import { create } from 'zustand';
import { CONFIG_WHITELABEL_DEFAULT, type ConfiguracionWhitelabel } from '../types/whitelabel';

interface WhitelabelState {
  config: ConfiguracionWhitelabel;
  setWhitelabel: (config: ConfiguracionWhitelabel) => void;
  resetWhitelabel: () => void;
}

/**
 * Inyecta un bloque de <style> en el <head> para aplicar los tokens Whitelabel.
 * Esto asegura que los estilos dinámicos respeten las clases `.dark` sin problemas de especificidad.
 */
function aplicarTokensCSS(config: ConfiguracionWhitelabel) {
  let styleEl = document.getElementById('whitelabel-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'whitelabel-theme';
    document.head.appendChild(styleEl);
  }

  // Generamos el CSS dinámico. Nota: se inyectan las fuentes y colores.
  styleEl.innerHTML = `
    :root {
      --primary: ${config.colores.colorPrincipal};
      --on-primary: ${config.colores.colorBotonTexto};
      --background: ${config.colores.colorFondoClaro};
      --surface: ${config.colores.colorSuperficieClaro};
      --surface-variant: color-mix(in srgb, ${config.colores.colorSuperficieClaro} 90%, #000);
      --surface-container-lowest: ${config.colores.colorSuperficieClaro};
      --surface-container-low: color-mix(in srgb, ${config.colores.colorSuperficieClaro} 96%, #000);
      --surface-container: color-mix(in srgb, ${config.colores.colorSuperficieClaro} 92%, #000);
      --surface-container-high: color-mix(in srgb, ${config.colores.colorSuperficieClaro} 88%, #000);
      --surface-container-highest: ${config.colores.colorSecundario};
      --on-background: ${config.colores.colorTextoClaro};
      --on-surface: ${config.colores.colorTextoClaro};
      --on-surface-variant: color-mix(in srgb, ${config.colores.colorTextoClaro} 80%, transparent);
      
      --font-display-lg: "${config.tipografia.fuenteTitulos}", var(--font-mono);
      --font-headline-md: "${config.tipografia.fuenteTitulos}", var(--font-mono);
      --font-body-lg: "${config.tipografia.fuenteContenido}", sans-serif;
      --font-body-md: "${config.tipografia.fuenteContenido}", sans-serif;
    }
    
    .dark {
      --primary: ${config.colores.colorPrincipal};
      --on-primary: ${config.colores.colorBotonTexto};
      --background: ${config.colores.colorFondoOscuro};
      --surface: ${config.colores.colorSuperficieOscuro};
      --surface-variant: color-mix(in srgb, ${config.colores.colorSuperficieOscuro} 80%, #fff);
      --surface-container-lowest: color-mix(in srgb, ${config.colores.colorSuperficieOscuro} 90%, #000);
      --surface-container-low: color-mix(in srgb, ${config.colores.colorSuperficieOscuro} 95%, #fff);
      --surface-container: color-mix(in srgb, ${config.colores.colorSuperficieOscuro} 90%, #fff);
      --surface-container-high: color-mix(in srgb, ${config.colores.colorSuperficieOscuro} 80%, #fff);
      --surface-container-highest: ${config.colores.colorSecundario};
      --on-background: ${config.colores.colorTextoOscuro};
      --on-surface: ${config.colores.colorTextoOscuro};
      --on-surface-variant: color-mix(in srgb, ${config.colores.colorTextoOscuro} 80%, transparent);
    }
  `;

  // Animaciones globales
  if (!config.interfaz.animacionesHabilitadas) {
    document.documentElement.style.setProperty('--transition-duration', '0s');
    document.documentElement.classList.add('no-animations');
  } else {
    document.documentElement.style.removeProperty('--transition-duration');
    document.documentElement.classList.remove('no-animations');
  }

  // Favicon
  if (config.marca.faviconUrl) {
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    // Si la URL es relativa de uploads, agregar la base url de la API
    const faviconUrl = config.marca.faviconUrl.startsWith('/') 
      ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${config.marca.faviconUrl}`
      : config.marca.faviconUrl;
    favicon.href = faviconUrl;
  }

  // Título del documento
  if (config.marca.nombreNegocio) {
    document.title = `${config.marca.nombreNegocio} - POS`;
  }
}

export const useWhitelabelStore = create<WhitelabelState>((set) => ({
  config: CONFIG_WHITELABEL_DEFAULT,
  
  setWhitelabel: (config) => {
    aplicarTokensCSS(config);
    set({ config });
  },
  
  resetWhitelabel: () => {
    aplicarTokensCSS(CONFIG_WHITELABEL_DEFAULT);
    set({ config: CONFIG_WHITELABEL_DEFAULT });
  }
}));
