import { Camera, Wrench, Bot, Music, Clock, Activity, Cpu } from 'lucide-react';
import type { SystemStatus, SofiaState } from '@/types';
import type { ActivityLog } from '@/lib/api';
import type { McpTool } from '@/hooks/useXiaoZhi';
import { StatusBadge } from '@/components/StatusBadge';

type Props = {
  status: SystemStatus;
  sofiaState: SofiaState;
  logs: ActivityLog[];
  onNavigate: (page: import('@/types').Page) => void;
  mcpTools: McpTool[];
};

const TOOLS = [
  { name: 'consultar_camara', desc: 'Toma una foto y la analiza con IA' },
  { name: 'mover_articulaciones', desc: 'Controla las 3 articulaciones del brazo' },
  { name: 'detener_servo', desc: 'Detiene una articulación específica' },
  { name: 'detener_servos', desc: 'Detiene todos los servos' },
  { name: 'estado_brazo', desc: 'Consulta el estado del brazo robótico' },
];

const ICON_MAP: Record<ActivityLog['type'], React.ElementType> = {
  camera: Camera,
  arm: Wrench,
  chat: Bot,
  music: Music,
  system: Cpu,
};

const TYPE_COLOR: Record<ActivityLog['type'], string> = {
  camera: 'bg-blue-100 text-blue-600',
  arm: 'bg-violet-100 text-violet-600',
  chat: 'bg-emerald-100 text-emerald-600',
  music: 'bg-pink-100 text-pink-600',
  system: 'bg-gray-100 text-gray-500',
};

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

const SYSTEM_COMPONENTS = [
  { key: 'camera' as const, label: 'ESP32-CAM', icon: Camera },
  { key: 'arm' as const, label: 'Brazo robótico', icon: Wrench },
  { key: 'xiaozhi' as const, label: 'XiaoZhi MCP', icon: Cpu },
  { key: 'gemini' as const, label: 'Gemini AI', icon: Bot },
];

const STATUS_LABEL = { online: 'En línea', offline: 'Fuera de línea', connecting: 'Conectando' };

export default function Home({ status, sofiaState, logs, onNavigate, mcpTools }: Props) {
  return (
    <div className="p-6 space-y-6">
      {/* Sofia greeting */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white flex items-start gap-4 shadow-lg shadow-blue-200">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Bot size={24} />
        </div>
        <div>
          <p className="font-bold text-xl">Hola, soy Sofía.</p>
          <p className="text-blue-100 text-sm mt-0.5">
            Estoy aquí para ayudarte. Puedes pedirme que vea la cámara, mueva el brazo robótico o cualquier otra cosa.
          </p>
        </div>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium bg-white/20 capitalize ${
          sofiaState !== 'idle' ? 'animate-pulse' : ''
        }`}>
          {sofiaState === 'idle' ? 'Lista' : sofiaState === 'listening' ? 'Escuchando' : sofiaState === 'thinking' ? 'Pensando' : 'Hablando'}
        </span>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { page: 'camera' as const, icon: Camera, label: 'Cámara en vivo', sub: '192.168.1.9', color: 'text-blue-500', bg: 'bg-blue-50', state: status.camera },
          { page: 'arm' as const, icon: Wrench, label: 'Brazo Robótico', sub: '192.168.1.7', color: 'text-violet-500', bg: 'bg-violet-50', state: status.arm },
          { page: 'chat' as const, icon: Bot, label: 'Chat con Sofía', sub: 'XiaoZhi MCP', color: 'text-emerald-500', bg: 'bg-emerald-50', state: status.xiaozhi },
          { page: 'music' as const, icon: Music, label: 'Música Spotify', sub: 'Reproducción', color: 'text-pink-500', bg: 'bg-pink-50', state: 'online' as const },
        ].map(({ page, icon: Icon, label, sub, color, bg, state }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="bg-white rounded-2xl p-5 text-left border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <Icon size={20} className={color} />
            </div>
            <p className="font-semibold text-gray-800 text-sm">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            <div className="mt-3">
              <StatusBadge state={state} label={STATUS_LABEL[state]} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* System status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-blue-500" />
            <h3 className="font-semibold text-gray-800">Estado del sistema</h3>
          </div>
          <div className="space-y-3">
            {SYSTEM_COMPONENTS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon size={15} className="text-gray-500" />
                  </div>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <StatusBadge state={status[key]} label={STATUS_LABEL[status[key]]} />
              </div>
            ))}
          </div>
        </div>

        {/* Activity log */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-blue-500" />
            <h3 className="font-semibold text-gray-800">Actividad reciente</h3>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin actividad aún</p>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 8).map((log) => {
                const Icon = ICON_MAP[log.type];
                return (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[log.type]}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{log.description}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(log.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Available tools — real XiaoZhi tools or fallback list */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-blue-500" />
            <h3 className="font-semibold text-gray-800">Herramientas MCP disponibles</h3>
          </div>
          {mcpTools.length > 0 && (
            <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              {mcpTools.length} desde XiaoZhi
            </span>
          )}
        </div>
        {mcpTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {mcpTools.map((tool) => (
              <div key={tool.name} className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 font-mono">{tool.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{tool.description ?? 'Sin descripción'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {TOOLS.map((tool) => (
              <div key={tool.name} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 font-mono">{tool.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
