export interface EstiloTexto {
  negrita?: boolean;
  subrayado?: boolean;
  alineacion?: 'left' | 'center' | 'right';
}

export const ESTILO_TEXTO_DEFAULT: EstiloTexto = {
  negrita: false,
  subrayado: false,
  alineacion: 'center',
};

export interface ConfigTicketVenta {
  mostrarLogo: boolean;
  logoUrl?: string;
  encabezado: string;
  estiloEncabezado?: EstiloTexto;
  slogan?: string;
  estiloSlogan?: EstiloTexto;
  direccion?: string;
  telefono?: string;
  rfc?: string;
  email?: string;
  estiloContacto?: EstiloTexto;
  mensajePie: string;
  estiloPie?: EstiloTexto;
  mostrarCajero: boolean;
  mostrarCliente: boolean;
  mostrarFechaHora: boolean;
  mostrarImpuestos: boolean;
  mostrarDesglosePagos: boolean;
  anchoMm: '80mm' | '58mm';
  tamanoFuente: 'pequena' | 'normal' | 'grande';
}

export interface ConfigTicketPresupuesto {
  mostrarLogo: boolean;
  logoUrl?: string;
  encabezado: string;
  estiloEncabezado?: EstiloTexto;
  slogan?: string;
  estiloSlogan?: EstiloTexto;
  direccion?: string;
  telefono?: string;
  rfc?: string;
  email?: string;
  estiloContacto?: EstiloTexto;
  mensajePie: string;
  estiloPie?: EstiloTexto;
  mostrarCajero: boolean;
  mostrarCliente: boolean;
  mostrarVencimiento: boolean;
  anchoMm: '80mm' | '58mm';
  tamanoFuente: 'pequena' | 'normal' | 'grande';
}

export interface ConfiguracionTicketCompleta {
  venta: ConfigTicketVenta;
  presupuesto: ConfigTicketPresupuesto;
}

export const CONFIG_TICKET_DEFAULT: ConfiguracionTicketCompleta = {
  venta: {
    mostrarLogo: false,
    logoUrl: '',
    encabezado: 'CUDII POS - COMPROBANTE DE VENTA',
    estiloEncabezado: { negrita: true, subrayado: false, alineacion: 'center' },
    slogan: '¡Gracias por su preferencia!',
    estiloSlogan: { negrita: false, subrayado: false, alineacion: 'center' },
    direccion: 'Av. Principal #123, Col. Centro',
    telefono: '(55) 1234-5678',
    rfc: 'XAXX010101000',
    email: 'contacto@ejemplo.com',
    estiloContacto: { negrita: false, subrayado: false, alineacion: 'center' },
    mensajePie: '¡Gracias por tu compra!',
    estiloPie: { negrita: false, subrayado: false, alineacion: 'center' },
    mostrarCajero: true,
    mostrarCliente: true,
    mostrarFechaHora: true,
    mostrarImpuestos: true,
    mostrarDesglosePagos: true,
    anchoMm: '80mm',
    tamanoFuente: 'normal',
  },
  presupuesto: {
    mostrarLogo: false,
    logoUrl: '',
    encabezado: 'CUDII POS - COTIZACIÓN / PRESUPUESTO',
    estiloEncabezado: { negrita: true, subrayado: false, alineacion: 'center' },
    slogan: 'Cotización informativa sin compromiso',
    estiloSlogan: { negrita: false, subrayado: false, alineacion: 'center' },
    direccion: 'Av. Principal #123, Col. Centro',
    telefono: '(55) 1234-5678',
    rfc: 'XAXX010101000',
    email: 'contacto@ejemplo.com',
    estiloContacto: { negrita: false, subrayado: false, alineacion: 'center' },
    mensajePie: '* Cotización informativa. Precios y existencias sujetos a cambios tras fecha de vencimiento.',
    estiloPie: { negrita: false, subrayado: false, alineacion: 'center' },
    mostrarCajero: true,
    mostrarCliente: true,
    mostrarVencimiento: true,
    anchoMm: '80mm',
    tamanoFuente: 'normal',
  },
};
