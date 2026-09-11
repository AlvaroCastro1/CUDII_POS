export interface ColoresWhitelabel {
  colorPrincipal: string;
  colorSecundario: string;
  colorBoton: string;
  colorBotonTexto: string;
  colorFondoClaro: string;
  colorFondoOscuro: string;
  colorSuperficieClaro: string;
  colorSuperficieOscuro: string;
  colorTextoClaro: string;
  colorTextoOscuro: string;
}

export interface MarcaWhitelabel {
  nombreNegocio: string;
  eslogan: string;
  logoPrincipalUrl: string | null;
  logoModoOscuroUrl: string | null;
  faviconUrl: string | null;
}

export interface TypografiaWhitelabel {
  fuenteTitulos: string;
  fuenteContenido: string;
}

export interface InterfazWhitelabel {
  modoPredeterminado: 'light' | 'dark' | 'system';
  animacionesHabilitadas: boolean;
  estiloNavegacion: 'sidebar' | 'topbar';
}

export interface ConfiguracionWhitelabel {
  marca: MarcaWhitelabel;
  colores: ColoresWhitelabel;
  tipografia: TypografiaWhitelabel;
  interfaz: InterfazWhitelabel;
}

export const CONFIG_WHITELABEL_DEFAULT: ConfiguracionWhitelabel = {
  marca: {
    nombreNegocio: '',
    eslogan: '',
    logoPrincipalUrl: null,
    logoModoOscuroUrl: null,
    faviconUrl: null,
  },
  colores: {
    colorPrincipal: '#000000',
    colorSecundario: '#1E293B',
    colorBoton: '#000000',
    colorBotonTexto: '#FFFFFF',
    colorFondoClaro: '#FDFCFF',
    colorFondoOscuro: '#131313',
    colorSuperficieClaro: '#FDFCFF',
    colorSuperficieOscuro: '#131313',
    colorTextoClaro: '#1A1C1E',
    colorTextoOscuro: '#E5E2E1',
  },
  tipografia: {
    fuenteTitulos: 'Geist',
    fuenteContenido: 'Geist',
  },
  interfaz: {
    modoPredeterminado: 'system',
    animacionesHabilitadas: true,
    estiloNavegacion: 'sidebar',
  },
};
