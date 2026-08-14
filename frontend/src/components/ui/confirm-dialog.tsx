import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  isLoading = false,
}: ConfirmDialogProps) {
  const getIconConfig = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-error" />,
          bg: 'bg-error/10',
          btn: 'bg-error hover:bg-error text-white shadow-sm shadow-error/20',
        };
      case 'info':
        return {
          icon: <Info className="w-6 h-6 text-primary" />,
          bg: 'bg-primary/10',
          btn: 'bg-primary hover:bg-primary text-white shadow-sm shadow-primary/20',
        };
      case 'warning':
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6 text-warning" />,
          bg: 'bg-warning/10',
          btn: 'bg-warning hover:bg-warning text-white shadow-sm shadow-warning/20',
        };
    }
  };

  const config = getIconConfig();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-[400px] p-6">
        <DialogHeader className="flex flex-col items-center gap-4 text-center">
          <div className={`flex-shrink-0 p-4 rounded-full ${config.bg}`}>
            {config.icon}
          </div>
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl font-bold tracking-tight text-on-surface">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-on-surface-variant max-w-[320px] mx-auto leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-8 flex gap-3 sm:justify-center w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto min-w-[120px]"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto min-w-[120px] ${config.btn}`}
            disabled={isLoading}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
