import React, { useEffect, useRef, useState } from 'react';
import {
  Palette,
  Save,
  Undo2,
  RefreshCcw,
  Image as ImageIcon,
  Layout,
  Type,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, obtenerUrlImagen } from '@/lib/api';
import { useWhitelabelStore } from '@/store/useWhitelabelStore';
import {
  type ConfiguracionWhitelabel,
  CONFIG_WHITELABEL_DEFAULT,
} from '@/types/whitelabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

// ─── Componente PreviewMiniApp ────────────────────────────────────────────────
const PreviewMiniApp = ({ config, mode }: { config: ConfiguracionWhitelabel; mode: 'light' | 'dark' }) => {
  // Aplicamos los colores en variables CSS inline
  const styleObj = {
    '--primary': config.colores.colorPrincipal,
    '--on-primary': config.colores.colorBotonTexto,
    '--background': mode === 'dark' ? config.colores.colorFondoOscuro : config.colores.colorFondoClaro,
    '--surface': mode === 'dark' ? config.colores.colorSuperficieOscuro : config.colores.colorSuperficieClaro,
    '--surface-container-highest': config.colores.colorSecundario,
    '--on-background': mode === 'dark' ? config.colores.colorTextoOscuro : config.colores.colorTextoClaro,
    '--on-surface': mode === 'dark' ? config.colores.colorTextoOscuro : config.colores.colorTextoClaro,
    '--font-display-lg': `"${config.tipografia.fuenteTitulos}", var(--font-mono)`,
    '--font-body-md': `"${config.tipografia.fuenteContenido}", sans-serif`,
  } as React.CSSProperties;

  return (
    <div 
      className={`relative w-full h-[600px] border rounded-xl overflow-hidden shadow-2xl flex transition-all ${config.interfaz.animacionesHabilitadas ? 'duration-300' : ''}`}
      style={styleObj}
    >
      {/* Sidebar Mock */}
      {config.interfaz.estiloNavegacion === 'sidebar' && (
        <div className="w-16 h-full flex flex-col items-center py-4 gap-4" style={{ backgroundColor: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}>
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
            {config.marca.logoPrincipalUrl ? (
               <img src={obtenerUrlImagen(mode === 'dark' ? (config.marca.logoModoOscuroUrl || config.marca.logoPrincipalUrl) : config.marca.logoPrincipalUrl)} alt="Logo" className="max-w-full max-h-full" />
            ) : (
               <Layout size={16} style={{ color: 'var(--primary)' }} />
            )}
          </div>
          <div className="w-8 h-8 rounded hover:bg-surface/10 cursor-pointer" />
          <div className="w-8 h-8 rounded hover:bg-surface/10 cursor-pointer" />
        </div>
      )}

      {/* Main Content Mock */}
      <div className="flex-1 h-full flex flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--on-background)' }}>
        {/* Header */}
        <header className="h-14 border-b flex items-center px-4 justify-between" style={{ borderColor: 'var(--surface-container-highest)', backgroundColor: config.interfaz.estiloNavegacion === 'topbar' ? 'var(--surface-container-highest)' : 'transparent' }}>
          {config.interfaz.estiloNavegacion === 'topbar' && (
             <div className="flex items-center gap-2 text-on-surface">
               {config.marca.logoPrincipalUrl && <img src={obtenerUrlImagen(config.marca.logoPrincipalUrl)} alt="Logo" className="h-6" />}
               <span className="font-bold" style={{ fontFamily: 'var(--font-display-lg)' }}>{config.marca.nombreNegocio || 'CUDII POS'}</span>
             </div>
          )}
          <div className="flex gap-2 ml-auto">
            <div className="w-24 h-6 rounded bg-surface border" style={{ borderColor: 'var(--surface-container-highest)' }} />
          </div>
        </header>
        
        {/* Body */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto" style={{ fontFamily: 'var(--font-body-md)' }}>
          <div>
            <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-display-lg)' }}>
              Hola, Equipo de {config.marca.nombreNegocio || 'Tu Negocio'}
            </h2>
            <p className="opacity-70 text-sm">{config.marca.eslogan || 'Bienvenido a tu panel de control.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl shadow-sm border flex flex-col gap-2" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--surface-container-highest)' }}>
              <span className="text-sm opacity-70">Ventas Hoy</span>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display-lg)' }}>$4,520.00</span>
            </div>
            <div className="p-4 rounded-xl shadow-sm border flex flex-col gap-2" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--primary)' }}>
              <span className="text-sm opacity-90">Acción Principal</span>
              <Button variant="secondary" className="mt-auto bg-transparent border border-on-primary hover:bg-on-primary/10">
                Cobrar Ticket
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Vista Principal ────────────────────────────────────────────────────────
export default function WhitelabelView() {
  const storeWhitelabel = useWhitelabelStore((state) => state.config);
  const setGlobalWhitelabel = useWhitelabelStore((state) => state.setWhitelabel);
  
  const [draft, setDraft] = useState<ConfiguracionWhitelabel>(storeWhitelabel);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingDark, setIsUploadingDark] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const fileInputLogo = useRef<HTMLInputElement>(null);
  const fileInputDark = useRef<HTMLInputElement>(null);
  const fileInputFavicon = useRef<HTMLInputElement>(null);

  // Al montar, nos aseguramos de tener la versión más fresca del backend
  useEffect(() => {
    cargarConfiguracion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarConfiguracion = async () => {
    try {
      const res = await api.get('/company-settings/whitelabel');
      setDraft(res.data);
      setGlobalWhitelabel(res.data);
    } catch (err) {
      toast.error('Error cargando configuración Whitelabel');
    }
  };

  const guardarConfiguracion = async () => {
    setIsSaving(true);
    try {
      const res = await api.patch('/company-settings/whitelabel', draft);
      setGlobalWhitelabel(res.data);
      setDraft(res.data);
      toast.success('Configuración Whitelabel actualizada. Los cambios ya son visibles en toda la app.');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo guardar la configuración'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadImagen = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'logo' | 'dark' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    if (tipo === 'logo') setIsUploadingLogo(true);
    if (tipo === 'dark') setIsUploadingDark(true);
    if (tipo === 'favicon') setIsUploadingFavicon(true);

    try {
      const res = await api.post<{ url: string }>('/company-settings/logo-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setDraft((prev) => ({
        ...prev,
        marca: {
          ...prev.marca,
          [tipo === 'logo' ? 'logoPrincipalUrl' : tipo === 'dark' ? 'logoModoOscuroUrl' : 'faviconUrl']: res.data.url,
        },
      }));
      toast.success('Imagen subida temporalmente. No olvides guardar.');
    } catch (err) {
      toast.error(errorMessage(err, 'Error subiendo imagen'));
    } finally {
      if (tipo === 'logo') { setIsUploadingLogo(false); if (fileInputLogo.current) fileInputLogo.current.value = ''; }
      if (tipo === 'dark') { setIsUploadingDark(false); if (fileInputDark.current) fileInputDark.current.value = ''; }
      if (tipo === 'favicon') { setIsUploadingFavicon(false); if (fileInputFavicon.current) fileInputFavicon.current.value = ''; }
    }
  };

  const actualizarColor = (key: keyof ConfiguracionWhitelabel['colores'], valor: string) => {
    setDraft((p) => ({ ...p, colores: { ...p.colores, [key]: valor } }));
  };

  return (
    <div className="h-full flex flex-col bg-background/50 relative">
      <div className="flex-none p-6 border-b flex justify-between items-center glass-panel z-10 rounded-b-2xl mx-4 mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display-lg flex items-center gap-2">
            <Palette className="text-primary" /> Marca y Apariencia
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Personaliza el portal web con la identidad visual de tu negocio. Los cambios aplicarán en todos los módulos.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => setDraft(CONFIG_WHITELABEL_DEFAULT)}
            disabled={isSaving}
          >
            <RefreshCcw size={16} className="mr-2" />
            Por Defecto
          </Button>
          <Button
            variant="outline"
            onClick={() => setDraft(storeWhitelabel)}
            disabled={isSaving || JSON.stringify(draft) === JSON.stringify(storeWhitelabel)}
          >
            <Undo2 size={16} className="mr-2" />
            Descartar Cambios
          </Button>
          <Button onClick={guardarConfiguracion} disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            Guardar Apariencia
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden px-4 pb-4 gap-4">
        {/* Panel Editor */}
        <div className="w-[500px] flex-none border rounded-2xl bg-surface/80 backdrop-blur flex flex-col h-full overflow-hidden shadow-sm">
          <Tabs defaultValue="marca" className="w-full flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b bg-surface/50">
              <TabsList className="w-full justify-start rounded-full bg-surface-container-low p-1 border h-auto overflow-x-auto">
                <TabsTrigger value="marca" className="rounded-full data-[state=active]:bg-surface data-[state=active]:shadow-sm px-4 py-2 flex-1">
                  <ImageIcon size={16} className="mr-2" /> Marca
                </TabsTrigger>
                <TabsTrigger value="colores" className="rounded-full data-[state=active]:bg-surface data-[state=active]:shadow-sm px-4 py-2 flex-1">
                  <Palette size={16} className="mr-2" /> Colores
                </TabsTrigger>
                <TabsTrigger value="tipografia" className="rounded-full data-[state=active]:bg-surface data-[state=active]:shadow-sm px-4 py-2 flex-1">
                  <Type size={16} className="mr-2" /> Texto
                </TabsTrigger>
                <TabsTrigger value="interfaz" className="rounded-full data-[state=active]:bg-surface data-[state=active]:shadow-sm px-4 py-2 flex-1">
                  <Layout size={16} className="mr-2" /> UI
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
              {/* TAB MARCA */}
              <TabsContent value="marca" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">Información del Negocio</h3>
                  <div>
                    <Label>Nombre del Negocio (Módulo POS y Factura)</Label>
                    <Input 
                      value={draft.marca.nombreNegocio} 
                      onChange={(e) => setDraft(p => ({ ...p, marca: { ...p.marca, nombreNegocio: e.target.value } }))} 
                      placeholder="Ej: Abarrotes Los Pinos"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Eslogan (Módulo Login y Tickets)</Label>
                    <Input 
                      value={draft.marca.eslogan} 
                      onChange={(e) => setDraft(p => ({ ...p, marca: { ...p.marca, eslogan: e.target.value } }))} 
                      placeholder="Ej: Calidad y servicio todos los días"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-semibold border-b pb-2">Logotipos y Favicon</h3>
                  
                  {/* Logo Principal */}
                  <div className="spatial-glass bento-card-hover rounded-xl p-5 relative overflow-hidden group">
                    <Label className="block mb-3 font-medium text-sm">Logo Principal (Modo Claro)</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded border bg-white flex items-center justify-center p-1">
                        {draft.marca.logoPrincipalUrl ? (
                          <img src={obtenerUrlImagen(draft.marca.logoPrincipalUrl)} alt="Logo" className="max-w-full max-h-full" />
                        ) : <ImageIcon className="opacity-20" size={24} />}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input type="file" ref={fileInputLogo} className="hidden" accept="image/*" onChange={(e) => handleUploadImagen(e, 'logo')} />
                        <Button variant="outline" size="sm" disabled={isUploadingLogo} onClick={() => fileInputLogo.current?.click()}>
                          {isUploadingLogo ? <Loader2 size={14} className="animate-spin mr-1" /> : 'Cambiar Logo'}
                        </Button>
                        {draft.marca.logoPrincipalUrl && (
                          <Button variant="ghost" size="sm" className="text-error" onClick={() => setDraft(p => ({ ...p, marca: { ...p.marca, logoPrincipalUrl: null } }))}>
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Logo Dark */}
                  <div className="spatial-glass bento-card-hover rounded-xl p-5 relative overflow-hidden group">
                    <Label className="block mb-3 font-medium text-sm">Logo Modo Oscuro (Opcional)</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded border bg-black flex items-center justify-center p-1">
                        {draft.marca.logoModoOscuroUrl ? (
                          <img src={obtenerUrlImagen(draft.marca.logoModoOscuroUrl)} alt="Logo Dark" className="max-w-full max-h-full" />
                        ) : <ImageIcon className="opacity-50 text-white" size={24} />}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input type="file" ref={fileInputDark} className="hidden" accept="image/*" onChange={(e) => handleUploadImagen(e, 'dark')} />
                        <Button variant="outline" size="sm" disabled={isUploadingDark} onClick={() => fileInputDark.current?.click()}>
                          {isUploadingDark ? <Loader2 size={14} className="animate-spin mr-1" /> : 'Subir Logo Oscuro'}
                        </Button>
                        {draft.marca.logoModoOscuroUrl && (
                          <Button variant="ghost" size="sm" className="text-error" onClick={() => setDraft(p => ({ ...p, marca: { ...p.marca, logoModoOscuroUrl: null } }))}>
                            Usar principal
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Favicon */}
                  <div className="spatial-glass bento-card-hover rounded-xl p-5 relative overflow-hidden group">
                    <Label className="block mb-3 font-medium text-sm">Ícono de pestaña (Favicon)</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded border bg-white flex items-center justify-center p-1">
                        {draft.marca.faviconUrl ? (
                          <img src={obtenerUrlImagen(draft.marca.faviconUrl)} alt="Favicon" className="max-w-full max-h-full" />
                        ) : <ImageIcon className="opacity-20" size={16} />}
                      </div>
                      <div className="flex-1">
                        <input type="file" ref={fileInputFavicon} className="hidden" accept="image/*" onChange={(e) => handleUploadImagen(e, 'favicon')} />
                        <Button variant="outline" size="sm" disabled={isUploadingFavicon} onClick={() => fileInputFavicon.current?.click()}>
                          Cambiar
                        </Button>
                      </div>
                    </div>
                  </div>

                </div>
              </TabsContent>

              {/* TAB COLORES */}
              <TabsContent value="colores" className="mt-0 space-y-6">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-start gap-3 mb-4">
                  <Palette className="text-primary mt-1" size={18} />
                  <p className="text-sm">
                    Recomendamos usar colores de buen contraste. El botón se usa para la acción principal y su texto debe ser legible.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">Identidad Principal</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Color Primario (--primary)</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorPrincipal} onChange={e => actualizarColor('colorPrincipal', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorPrincipal} onChange={e => actualizarColor('colorPrincipal', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                    <div className="spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Acento Secundario</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorSecundario} onChange={e => actualizarColor('colorSecundario', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorSecundario} onChange={e => actualizarColor('colorSecundario', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                    <div className="col-span-2 spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Texto sobre Primario</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorBotonTexto} onChange={e => actualizarColor('colorBotonTexto', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorBotonTexto} onChange={e => actualizarColor('colorBotonTexto', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-semibold border-b pb-2">Modo Claro (Fondos y Textos)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Fondo Base</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorFondoClaro} onChange={e => actualizarColor('colorFondoClaro', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorFondoClaro} onChange={e => actualizarColor('colorFondoClaro', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                    <div className="spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Superficie (Tarjetas)</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorSuperficieClaro} onChange={e => actualizarColor('colorSuperficieClaro', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorSuperficieClaro} onChange={e => actualizarColor('colorSuperficieClaro', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                    <div className="col-span-2 spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Texto General Claro</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorTextoClaro} onChange={e => actualizarColor('colorTextoClaro', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorTextoClaro} onChange={e => actualizarColor('colorTextoClaro', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 opacity-90">
                  <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                    <Moon size={16}/> Modo Oscuro
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Fondo Base</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorFondoOscuro} onChange={e => actualizarColor('colorFondoOscuro', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorFondoOscuro} onChange={e => actualizarColor('colorFondoOscuro', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                    <div className="spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Superficie (Tarjetas)</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorSuperficieOscuro} onChange={e => actualizarColor('colorSuperficieOscuro', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorSuperficieOscuro} onChange={e => actualizarColor('colorSuperficieOscuro', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                    <div className="col-span-2 spatial-glass rounded-xl p-3 shadow-sm border border-outline-variant/30">
                      <Label className="text-xs opacity-70">Texto General Oscuro</Label>
                      <div className="flex mt-1.5 rounded-lg overflow-hidden border">
                        <input type="color" value={draft.colores.colorTextoOscuro} onChange={e => actualizarColor('colorTextoOscuro', e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer" />
                        <Input value={draft.colores.colorTextoOscuro} onChange={e => actualizarColor('colorTextoOscuro', e.target.value)} className="border-none rounded-none focus-visible:ring-0 shadow-none font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB TIPOGRAFÍA */}
              <TabsContent value="tipografia" className="mt-0 space-y-6">
                <div>
                  <Label>Fuente para Títulos (Ej: Dongle, Geist, Poppins)</Label>
                  <Select 
                    value={draft.tipografia.fuenteTitulos} 
                    onValueChange={v => setDraft(p => ({ ...p, tipografia: { ...p.tipografia, fuenteTitulos: v } }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Geist">Geist (Moderno, Limpio)</SelectItem>
                      <SelectItem value="Inter">Inter (Legibilidad)</SelectItem>
                      <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans (Web 3.0)</SelectItem>
                      <SelectItem value="Poppins">Poppins (Redondeada, Amigable)</SelectItem>
                      <SelectItem value="Dongle">Dongle (Compacta, POS Totales)</SelectItem>
                      <SelectItem value="Outfit">Outfit (Tecnológica)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fuente para Contenido (Ej: Inter, Plus Jakarta)</Label>
                  <Select 
                    value={draft.tipografia.fuenteContenido} 
                    onValueChange={v => setDraft(p => ({ ...p, tipografia: { ...p.tipografia, fuenteContenido: v } }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Geist">Geist (Moderno)</SelectItem>
                      <SelectItem value="Inter">Inter (Muy legible)</SelectItem>
                      <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                      <SelectItem value="Roboto">Roboto (Android Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="mt-8 spatial-glass rounded-2xl p-6 border shadow-sm" style={{ fontFamily: `"${draft.tipografia.fuenteContenido}", sans-serif` }}>
                   <p className="text-sm text-primary mb-4 font-semibold uppercase tracking-wider flex items-center gap-2">
                     <Type size={16}/> Previsualización de Fuentes
                   </p>
                   <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: `"${draft.tipografia.fuenteTitulos}", sans-serif` }}>Este es un Título Principal</h1>
                   <h2 className="text-2xl font-semibold mb-4 text-on-surface-variant" style={{ fontFamily: `"${draft.tipografia.fuenteTitulos}", sans-serif` }}>Este es un Subtítulo Secundario</h2>
                   <p className="leading-relaxed opacity-90">Este es el texto del contenido. Aquí se muestran descripciones largas, tablas de productos y configuraciones generales del sistema. Una buena fuente mejora la legibilidad en pantallas complejas.</p>
                </div>
              </TabsContent>

              {/* TAB INTERFAZ */}
              <TabsContent value="interfaz" className="mt-0 space-y-6">
                <div>
                  <Label>Modo de Pantalla por Defecto para Nuevos Usuarios</Label>
                  <Select 
                    value={draft.interfaz.modoPredeterminado} 
                    onValueChange={v => setDraft(p => ({ ...p, interfaz: { ...p.interfaz, modoPredeterminado: v as any } }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">Automático (Sistema del Dispositivo)</SelectItem>
                      <SelectItem value="light">Fijar Modo Claro</SelectItem>
                      <SelectItem value="dark">Fijar Modo Oscuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Estilo de Navegación del Panel de Control</Label>
                  <Select 
                    value={draft.interfaz.estiloNavegacion} 
                    onValueChange={v => setDraft(p => ({ ...p, interfaz: { ...p.interfaz, estiloNavegacion: v as 'sidebar'|'topbar' } }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sidebar">Barra Lateral (Recomendado)</SelectItem>
                      <SelectItem value="topbar">Barra Superior (Estilo App Movil)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="spatial-glass bento-card-hover flex items-center justify-between p-5 border rounded-xl">
                  <div>
                    <Label className="text-base font-semibold">Animaciones Interactivas</Label>
                    <p className="text-sm text-on-surface-variant mt-1">Suaviza las transiciones y modales. Desactivar ahorra batería en dispositivos lentos.</p>
                  </div>
                  <Switch 
                    checked={draft.interfaz.animacionesHabilitadas} 
                    onCheckedChange={v => setDraft(p => ({ ...p, interfaz: { ...p.interfaz, animacionesHabilitadas: v } }))} 
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Panel Preview */}
        <div className="flex-1 bg-surface-variant/20 rounded-2xl border p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
          
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <h3 className="font-semibold opacity-70">Vista Previa en Tiempo Real</h3>
              <div className="flex bg-surface border rounded-lg p-1">
                <Button 
                  variant={previewMode === 'light' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setPreviewMode('light')}
                  className="h-7 text-xs px-3"
                >
                  <Sun size={14} className="mr-1" /> Claro
                </Button>
                <Button 
                  variant={previewMode === 'dark' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setPreviewMode('dark')}
                  className="h-7 text-xs px-3"
                >
                  <Moon size={14} className="mr-1" /> Oscuro
                </Button>
              </div>
            </div>
            
            <PreviewMiniApp config={draft} mode={previewMode} />
          </div>

        </div>
      </div>
    </div>
  );
}
