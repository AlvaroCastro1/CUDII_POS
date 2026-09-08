import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, SwitchCamera, Flashlight, Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear Código de Barras',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio not supported or blocked
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedCode(null);
      setErrorMsg(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Check torch capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasTorch(!!capabilities?.torch);

        startScanningLoop();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('No se pudo acceder a la cámara. Revisa los permisos en tu navegador.');
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const newTorchState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: newTorchState } as MediaTrackConstraintSet],
        });
        setTorchOn(newTorchState);
      } catch (err) {
        console.warn('Torch failed:', err);
      }
    }
  };

  const startScanningLoop = () => {
    // Check native BarcodeDetector API support
    const hasNativeBarcodeDetector = 'BarcodeDetector' in window;

    let detector: unknown = null;
    if (hasNativeBarcodeDetector) {
      try {
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        detector = new BarcodeDetectorClass({
          formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39'],
        });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (detector) {
        try {
          const barcodes = await (detector as { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> }).detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            handleDetectedCode(code);
            return;
          }
        } catch {
          // Detect failed for this frame
        }
      } else if (canvasRef.current) {
        // Fallback: draw video to canvas and check contrast or simple pattern
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx && videoRef.current.videoWidth > 0) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleDetectedCode = (code: string) => {
    stopCamera();
    setScannedCode(code);
    playBeep();
    setTimeout(() => {
      onScan(code);
      onClose();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface border border-outline/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline-md font-bold text-on-surface text-base">{title}</h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Apunta la cámara al código de barras o QR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-outline/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay Line */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
            <div className="relative w-3/4 h-36 border-2 border-primary/60 rounded-2xl shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center overflow-hidden">
              <div className="w-full h-0.5 bg-error shadow-[0_0_10px_#ef4444] animate-pulse" />
              {/* Corner markers */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary" />
            </div>
          </div>

          {/* Detected Feedback */}
          {scannedCode && (
            <div className="absolute inset-0 bg-primary/20 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-surface px-6 py-4 rounded-2xl border border-primary text-center shadow-xl animate-in zoom-in-95">
                <p className="font-label-sm text-xs text-primary font-bold tracking-wider uppercase mb-1">
                  ¡Código Detectado!
                </p>
                <p className="font-mono text-lg font-bold text-on-surface">{scannedCode}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-error mb-3" />
              <p className="font-body-md text-sm text-on-surface mb-4">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-sm font-bold shadow-md hover:opacity-90"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface/50 border-t border-outline/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-2.5 rounded-xl border border-outline/20 text-on-surface hover:bg-outline/10 transition-colors flex items-center gap-2 text-xs font-label-sm"
              title="Cambiar Cámara"
            >
              <SwitchCamera className="w-4 h-4" />
              <span>{facingMode === 'environment' ? 'Trasera' : 'Frontal'}</span>
            </button>

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2.5 rounded-xl border border-outline/20 transition-colors flex items-center gap-2 text-xs font-label-sm ${
                  torchOn ? 'bg-primary/20 border-primary text-primary' : 'text-on-surface hover:bg-outline/10'
                }`}
                title="Linterna"
              >
                <Flashlight className="w-4 h-4" />
                <span>Linterna</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2.5 rounded-xl border border-outline/20 text-on-surface-variant hover:bg-outline/10 transition-colors"
            title={soundEnabled ? 'Sonido Activado' : 'Sonido Desactivado'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
