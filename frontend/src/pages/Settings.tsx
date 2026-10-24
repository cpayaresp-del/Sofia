import { useState } from 'react';
import { Settings, Save, Eye, EyeOff, Info, Wifi, RefreshCw, CheckCircle, Cpu } from 'lucide-react';
import type { McpConnectionState } from '@/hooks/useXiaoZhi';
import { XIAOZHI_WS_URL } from '@/lib/xiaozhi';

type Props = {
  onRefreshStatus: () => void;
  xiaozhiState: McpConnectionState;
};

type Config = {
  cameraIp: string;
  armIp: string;
  geminiKey: string;
  spotifyClientId: string;
  spotifyClientSecret: string;
  sofiaName: string;
  language: string;
};

export default function SettingsPage({ onRefreshStatus, xiaozhiState }: Props) {
  const [config, setConfig] = useState<Config>({
    cameraIp: '192.168.1.9',
    armIp: '192.168.1.7',
    geminiKey: '',
    spotifyClientId: '',
    spotifyClientSecret: '',
    sofiaName: 'Sofía',
    language: 'es-ES',
  });
  const [showGemini, setShowGemini] = useState(false);
  const [showSpotify, setShowSpotify] = useState(false);
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('sofia_config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Configuración</h2>
        <p className="text-sm text-gray-500 mt-0.5">Conecta los servicios y dispositivos de Sofía</p>
      </div>

      {/* Network */}
      <Section title="Red y dispositivos" icon={<Wifi size={15} className="text-blue-500" />}>
        <div className="space-y-4">
          <Field
            label="IP de la cámara (ESP32-CAM)"
            hint="Normalmente 192.168.1.x"
            value={config.cameraIp}
            onChange={(v) => setConfig((c) => ({ ...c, cameraIp: v }))}
          />
          <Field
            label="IP del brazo robótico"
            hint="Controlador ESP32"
            value={config.armIp}
            onChange={(v) => setConfig((c) => ({ ...c, armIp: v }))}
          />
          <button
            onClick={onRefreshStatus}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <RefreshCw size={13} />
            Verificar conexión ahora
          </button>
        </div>
      </Section>

      {/* XiaoZhi MCP */}
      <Section title="XiaoZhi MCP" icon={<Cpu size={15} className="text-blue-500" />}>
        <div className="space-y-3">
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium ${
            xiaozhiState === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            xiaozhiState === 'connecting' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-red-50 text-red-600 border-red-200'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              xiaozhiState === 'connected' ? 'bg-emerald-500' :
              xiaozhiState === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
            }`} />
            {xiaozhiState === 'connected' ? 'Conectado a XiaoZhi' :
             xiaozhiState === 'connecting' ? 'Conectando con XiaoZhi...' : 'Sin conexión MCP'}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Endpoint WSS</label>
            <p className="text-xs font-mono text-gray-600 bg-gray-50 rounded-xl px-3 py-2 break-all border border-gray-100">
              {XIAOZHI_WS_URL.replace(/token=.*/, 'token=••••••••')}
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-xl p-3">
            <Info size={13} className="flex-shrink-0 mt-0.5" />
            <p>El token JWT está integrado en la app y se conecta automáticamente al iniciar. La conexión se restablece sola si se cae.</p>
          </div>
        </div>
      </Section>

      {/* Gemini */}
      <Section title="Gemini AI (Google)" icon={<Settings size={15} className="text-blue-500" />}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Clave de API de Gemini</label>
            <div className="relative">
              <input
                type={showGemini ? 'text' : 'password'}
                value={config.geminiKey}
                onChange={(e) => setConfig((c) => ({ ...c, geminiKey: e.target.value }))}
                placeholder="AIza..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => setShowGemini((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-xl p-3">
            <Info size={13} className="flex-shrink-0 mt-0.5" />
            <p>La clave se guarda localmente en tu navegador y se usa para describir imágenes y generar respuestas de chat.</p>
          </div>
        </div>
      </Section>

      {/* Spotify */}
      <Section title="Spotify" icon={<Settings size={15} className="text-blue-500" />}>
        <div className="space-y-4">
          <Field
            label="Client ID de Spotify"
            value={config.spotifyClientId}
            onChange={(v) => setConfig((c) => ({ ...c, spotifyClientId: v }))}
            placeholder="Desde el panel de desarrolladores de Spotify"
          />
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Client Secret</label>
            <div className="relative">
              <input
                type={showSpotify ? 'text' : 'password'}
                value={config.spotifyClientSecret}
                onChange={(e) => setConfig((c) => ({ ...c, spotifyClientSecret: e.target.value }))}
                placeholder="••••••••••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => setShowSpotify((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSpotify ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Personality */}
      <Section title="Personalidad" icon={<Settings size={15} className="text-blue-500" />}>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Nombre del asistente"
            value={config.sofiaName}
            onChange={(v) => setConfig((c) => ({ ...c, sofiaName: v }))}
          />
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Idioma de voz</label>
            <select
              value={config.language}
              onChange={(e) => setConfig((c) => ({ ...c, language: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="es-ES">Español (España)</option>
              <option value="es-MX">Español (México)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Save */}
      <button
        onClick={save}
        className={`flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all ${
          saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {saved ? <CheckCircle size={16} /> : <Save size={16} />}
        {saved ? 'Guardado' : 'Guardar configuración'}
      </button>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, hint, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 mb-1">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
