import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Atajo {
  teclas: string[];
  descripcion: string;
}

const GRUPOS: { titulo: string; atajos: Atajo[] }[] = [
  {
    titulo: 'Generales',
    atajos: [
      { teclas: ['Ctrl', 'K'], descripcion: 'Abrir el buscador global' },
      { teclas: ['Ctrl', 'Alt', 'B'], descripcion: 'Mostrar u ocultar el menú lateral' },
      { teclas: ['Alt', 'T'], descripcion: 'Cambiar entre tema claro y oscuro' },
      { teclas: ['Ctrl', '/'], descripcion: 'Ver estos atajos de teclado' },
    ],
  },
  {
    titulo: 'Dentro del buscador',
    atajos: [
      { teclas: ['↑', '↓'], descripcion: 'Navegar entre los resultados' },
      { teclas: ['Enter'], descripcion: 'Abrir el elemento seleccionado' },
      { teclas: ['Esc'], descripcion: 'Cerrar el buscador' },
    ],
  },
];

export function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-md border border-outline/25 bg-on-surface/5 font-label-sm text-xs text-on-surface-variant shadow-sm">
      {children}
    </kbd>
  );
}

export default function AtajosTecladoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="text-left">
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Acciones rápidas disponibles en toda la aplicación.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto custom-scrollbar -mx-1 px-1">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="mb-5 last:mb-0">
              <h3 className="font-label-sm text-[10px] uppercase tracking-widest text-outline mb-2">
                {grupo.titulo}
              </h3>
              <div className="divide-y divide-outline/10">
                {grupo.atajos.map((a) => (
                  <div
                    key={a.descripcion}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <span className="text-sm font-headline-md font-medium text-on-surface">
                      {a.descripcion}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {a.teclas.map((t, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          {i > 0 && (
                            <span className="text-[10px] font-label-sm text-outline">+</span>
                          )}
                          <Tecla>{t}</Tecla>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-label-sm text-outline pt-3 border-t border-outline/10 flex items-center gap-1 flex-wrap">
          Consejo: pulsa
          <Tecla>Ctrl</Tecla>
          +
          <Tecla>K</Tecla>
          y escribe "atajos", "tema" o "menú" para ejecutar acciones.
        </p>
      </DialogContent>
    </Dialog>
  );
}
