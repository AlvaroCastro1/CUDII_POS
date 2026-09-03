export interface ConfigTicketVenta {
  mostrarLogo: boolean;
  logoUrl?: string;
  encabezado: string;
  slogan?: string;
  direccion?: string;
  telefono?: string;
  rfc?: string;
  email?: string;
  mensajePie: string;
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
  slogan?: string;
  direccion?: string;
  telefono?: string;
  rfc?: string;
  email?: string;
  mensajePie: string;
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
    slogan: '¡Gracias por su preferencia!',
    direccion: 'Av. Principal #123, Col. Centro',
    telefono: '(55) 1234-5678',
    rfc: 'XAXX010101000',
    email: 'contacto@ejemplo.com',
    mensajePie: '¡Gracias por tu compra!',
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
    slogan: 'Cotización informativa sin compromiso',
    direccion: 'Av. Principal #123, Col. Centro',
    telefono: '(55) 1234-5678',
    rfc: 'XAXX010101000',
    email: 'contacto@ejemplo.com',
    mensajePie: '* Cotización informativa. Precios y existencias sujetos a cambios tras fecha de vencimiento.',
    mostrarCajero: true,
    mostrarCliente: true,
    mostrarVencimiento: true,
    anchoMm: '80mm',
    tamanoFuente: 'normal',
  },
};
