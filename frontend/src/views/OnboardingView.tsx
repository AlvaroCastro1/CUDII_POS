import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';

export default function OnboardingView() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    branchName: '',
    registerId: '',
    adminEmail: '',
    adminPass: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = (step: number) => {
    if (step > currentStep) {
      if (currentStep === 1 && !formData.businessName) {
        toast.error("Ingresa el nombre del negocio");
        return;
      }
      if (currentStep === 2 && (!formData.branchName || !formData.registerId)) {
        toast.error("Completa los datos de infraestructura");
        return;
      }
    }
    setCurrentStep(step);
  };

  const handleFinish = async () => {
    if (!formData.adminEmail || !formData.adminPass) {
      toast.error("Ingresa los datos del administrador");
      return;
    }
    
    setIsLoading(true);
    try {
      // POST al nuevo endpoint de Onboarding Atómico
      const { data } = await api.post('/onboarding', formData);
      
      setShowSuccess(true);
      
      // Auto-Login
      const loginRes = await api.post('/auth/login', {
        email: formData.adminEmail,
        password: formData.adminPass
      });
      
      setTimeout(() => {
        setAuth(loginRes.data.access_token, loginRes.data.user);
        navigate('/');
      }, 3000);
      
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error al crear el ecosistema CUDII");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>
        {`
          .glass-panel {
            background: rgba(var(--surface), 0.03);
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            border: 1px solid var(--outline-variant);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
          .liquid-input {
            background: transparent;
            border: none;
            border-bottom: 2px solid var(--outline-variant);
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
          }
          .liquid-input:focus {
            outline: none;
            border-bottom-color: var(--on-surface);
            box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.1);
          }
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          .ambient-sphere {
            animation: float 15s ease-in-out infinite;
          }
        `}
      </style>

      {/* Ambient Background Layer */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] ambient-sphere"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-on-surface/5 rounded-full blur-[100px] ambient-sphere" style={{ animationDelay: '-5s' }}></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[80px] ambient-sphere" style={{ animationDelay: '-10s' }}></div>
      </div>

      {/* Onboarding Container */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-panel-padding">
        
        {/* Header Branding */}
        <header className="fixed top-container-margin flex flex-col items-center">
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg tracking-tighter text-primary">CUDII</h1>
          <p className="font-label-sm text-label-sm text-outline tracking-[0.2em] mt-2">CONFIGURACIÓN INICIAL</p>
        </header>

        {/* Progress Indicator */}
        {!showSuccess && (
          <div className="w-full max-w-[400px] mb-12 flex justify-between relative">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-on-surface/10 -translate-y-1/2 z-0"></div>
            <div 
              className="absolute top-1/2 left-0 h-[1px] bg-primary -translate-y-1/2 z-0 transition-all duration-700 ease-in-out" 
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            ></div>
            
            {[1, 2, 3].map(step => (
              <div key={step} className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center text-label-sm transition-all duration-500 ${
                step < currentStep 
                  ? 'bg-primary text-on-primary border-primary' 
                  : step === currentStep 
                    ? 'bg-on-surface text-surface border-on-surface'
                    : 'bg-surface-container border-outline-variant text-on-surface-variant'
              }`}>
                {step < currentStep ? <span className="material-symbols-outlined !text-sm">check</span> : step}
              </div>
            ))}
          </div>
        )}

        {/* Glass Main Card */}
        <div className="glass-panel w-full max-w-[640px] rounded-[32px] p-12 relative overflow-hidden">
          
          {showSuccess ? (
            <section className="flex flex-col items-center text-center py-8">
              <div className="w-24 h-24 rounded-full bg-primary text-on-primary flex items-center justify-center mb-8 animate-bounce">
                <span className="material-symbols-outlined !text-5xl">check_circle</span>
              </div>
              <h2 className="font-display-lg text-display-lg-mobile text-primary mb-4">¡Todo listo!</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[320px]">
                Estamos preparando tu terminal CUDII. Serás redirigido en unos segundos.
              </p>
            </section>
          ) : (
            <form onSubmit={e => e.preventDefault()} className="relative">
              
              {/* Step 1: Business Name */}
              {currentStep === 1 && (
                <section className="flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                  <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg-mobile text-primary mb-4">¿Cómo se llama tu negocio?</h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-12">Comencemos con lo básico. Este nombre aparecerá en tus facturas y reportes.</p>
                  
                  <div className="relative group">
                    <input 
                      type="text" 
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      className="liquid-input w-full py-6 font-display-lg text-display-lg-mobile md:text-display-lg-mobile text-on-surface placeholder:text-on-surface/20" 
                      placeholder="Ej: Café Estelar" 
                      required 
                      autoComplete="off"
                    />
                    <span className="material-symbols-outlined absolute right-0 bottom-6 text-outline group-focus-within:text-primary transition-colors">storefront</span>
                  </div>
                  
                  <div className="mt-16 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => handleNext(2)}
                      className="px-8 py-4 bg-primary text-on-primary font-bold rounded-full hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 group"
                    >
                      Continuar
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                  </div>
                </section>
              )}

              {/* Step 2: Infrastructure */}
              {currentStep === 2 && (
                <section className="flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                  <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg-mobile text-primary mb-4">Configura tu estructura</h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-12">Define tu primera sucursal y el punto de venta inicial.</p>
                  
                  <div className="space-y-10">
                    <div className="relative group">
                      <label className="font-label-sm text-label-sm text-outline block mb-2">NOMBRE DE LA SUCURSAL</label>
                      <input 
                        type="text" 
                        name="branchName"
                        value={formData.branchName}
                        onChange={handleChange}
                        className="liquid-input w-full py-4 font-headline-md text-headline-md text-on-surface placeholder:text-on-surface/20" 
                        placeholder="Sucursal Principal" 
                        required 
                      />
                    </div>
                    <div className="relative group">
                      <label className="font-label-sm text-label-sm text-outline block mb-2">IDENTIFICADOR DE CAJA</label>
                      <input 
                        type="text" 
                        name="registerId"
                        value={formData.registerId}
                        onChange={handleChange}
                        className="liquid-input w-full py-4 font-headline-md text-headline-md text-on-surface placeholder:text-on-surface/20" 
                        placeholder="Caja 01 - Principal" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-16 flex justify-between items-center">
                    <button type="button" onClick={() => handleNext(1)} className="px-8 py-4 text-outline font-medium hover:text-on-surface transition-colors">Atrás</button>
                    <button type="button" onClick={() => handleNext(3)} className="px-8 py-4 bg-primary text-on-primary font-bold rounded-full animate-hover animate-press flex items-center gap-2 group">
                      Continuar
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                  </div>
                </section>
              )}

              {/* Step 3: Admin */}
              {currentStep === 3 && (
                <section className="flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                  <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg-mobile text-primary mb-4">Acceso de Administrador</h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-12">Crea las credenciales maestras para gestionar tu ecosistema.</p>
                  
                  <div className="space-y-10">
                    <div className="relative group">
                      <label className="font-label-sm text-label-sm text-outline block mb-2">CORREO ELECTRÓNICO</label>
                      <input 
                        type="email" 
                        name="adminEmail"
                        value={formData.adminEmail}
                        onChange={handleChange}
                        className="liquid-input w-full py-4 font-headline-md text-headline-md text-on-surface placeholder:text-on-surface/20" 
                        placeholder="admin@tualma.com" 
                        required 
                      />
                    </div>
                    <div className="relative group">
                      <label className="font-label-sm text-label-sm text-outline block mb-2">CONTRASEÑA</label>
                      <input 
                        type="password" 
                        name="adminPass"
                        value={formData.adminPass}
                        onChange={handleChange}
                        className="liquid-input w-full py-4 font-headline-md text-headline-md text-on-surface placeholder:text-on-surface/20" 
                        placeholder="••••••••" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-16 flex justify-between items-center">
                    <button type="button" onClick={() => handleNext(2)} className="px-8 py-4 text-outline font-medium hover:text-on-surface transition-colors">Atrás</button>
                    <button 
                      type="button" 
                      disabled={isLoading}
                      onClick={handleFinish} 
                      className="px-10 py-4 bg-on-surface text-surface font-bold rounded-full animate-hover animate-press flex items-center gap-2 group disabled:opacity-50"
                    >
                      {isLoading ? 'Configurando...' : 'Finalizar Setup'}
                      {!isLoading && <span className="material-symbols-outlined group-hover:scale-110 transition-transform">auto_awesome</span>}
                    </button>
                  </div>
                </section>
              )}
            </form>
          )}

        </div>

        <footer className="mt-12">
          <p className="font-label-sm text-label-sm text-outline/50">© 2026 CUDII POS.</p>
        </footer>
      </main>
    </>
  );
}
