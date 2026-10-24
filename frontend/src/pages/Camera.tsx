import { useState, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Maximize2, Eye, AlertTriangle, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

const CAMERA_IP = '192.168.1.9';
const CAPTURE_URL = `http://${CAMERA_IP}/capture`;
const STREAM_URL = `http://${CAMERA_IP}:81/stream`;

type Props = {
  cameraStatus: 'online' | 'offline' | 'connecting';
  addLog: (type: 'camera', desc: string) => void;
};

export default function CameraPage({ cameraStatus, addLog }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgKey = useRef(0);

  const takePhoto = useCallback(async () => {
    setLoadingPhoto(true);
    setError(null);
    setDescription(null);
    try {
      const res = await fetch(CAPTURE_URL, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('La cámara no respondió correctamente');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setImgSrc(url);
      imgKey.current++;
      addLog('camera', 'Foto tomada desde ESP32-CAM');
    } catch {
      setError('No se pudo conectar con la cámara. Verifica que esté en línea en 192.168.1.9');
    } finally {
      setLoadingPhoto(false);
    }
  }, [addLog]);

  const describePhoto = useCallback(async () => {
    if (!imgSrc) return;
    setLoadingDesc(true);
    setDescription(null);
    try {
      // Placeholder: actual Gemini call goes through edge function
      await new Promise((r) => setTimeout(r, 1500));
      setDescription('(Conecta tu clave de Gemini en Configuración para obtener descripciones de imagen automáticas.)');
      addLog('camera', 'Descripción de imagen solicitada a Gemini AI');
    } finally {
      setLoadingDesc(false);
    }
  }, [imgSrc, addLog]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cámara en tiempo real</h2>
          <p className="text-sm text-gray-500 mt-0.5">{CAMERA_IP}</p>
        </div>
        <StatusBadge state={cameraStatus} label={cameraStatus === 'online' ? 'Conectada' : cameraStatus === 'connecting' ? 'Conectando' : 'Fuera de línea'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Camera view */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Camera size={16} className="text-blue-500" />
              <span className="font-semibold text-sm text-gray-800">Vista en vivo</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={takePhoto}
                disabled={loadingPhoto}
                className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                Tomar foto
              </button>
              <button
                onClick={takePhoto}
                disabled={loadingPhoto}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} />
                Actualizar
              </button>
              {imgSrc && (
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Maximize2 size={12} />
                  Ver en grande
                </button>
              )}
            </div>
          </div>

          <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
            {imgSrc ? (
              <img
                key={imgKey.current}
                src={imgSrc}
                alt="Foto ESP32-CAM"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-500 space-y-2">
                <Camera size={40} className="mx-auto opacity-30" />
                <p className="text-sm">Toma una foto para ver la imagen</p>
              </div>
            )}
            {loadingPhoto && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-white" />
              </div>
            )}
          </div>

          {/* MJPEG stream info */}
          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>Stream MJPEG:</strong> {STREAM_URL} — Si tu firmware lo soporta, el iframe de abajo mostrará video fluido.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* AI description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={15} className="text-blue-500" />
              <span className="font-semibold text-sm text-gray-800">Lo que ve Sofía</span>
            </div>
            {description ? (
              <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
            ) : (
              <p className="text-sm text-gray-400">
                {imgSrc ? 'Pulsa "Describir" para que Sofía analice la imagen.' : 'Primero toma una foto para describir la escena.'}
              </p>
            )}
            <button
              onClick={describePhoto}
              disabled={!imgSrc || loadingDesc}
              className="mt-3 w-full flex items-center justify-center gap-2 text-sm bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {loadingDesc ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              {loadingDesc ? 'Analizando...' : 'Describir imagen'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Live stream */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-sm text-gray-800 mb-3">Video en tiempo real (MJPEG)</p>
            <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video">
              <iframe
                title="ESP32-CAM stream"
                src={STREAM_URL}
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Requiere firmware con soporte MJPEG</p>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && imgSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLightboxOpen(false)}
        >
          <img src={imgSrc} alt="Vista completa" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
