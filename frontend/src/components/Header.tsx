import { Wifi, WifiOff, Clock, Cpu } from 'lucide-react';
import type { SystemStatus, SofiaState } from '@/types';

type Props = {
  status: SystemStatus;
  sofiaState: SofiaState;
  clock: Date;
};

const STATE_LABEL: Record<SofiaState, string> = {
  idle: 'En reposo',
  listening: 'Escuchando...',
  thinking: 'Pensando...',
  speaking: 'Hablando...',
};

const STATE_COLOR: Record<SofiaState, string> = {
  idle: 'text-gray-400',
  listening: 'text-blue-500',
  thinking: 'text-amber-500',
  speaking: 'text-emerald-500',
};

function StatusDot({ state }: { state: 'online' | 'offline' | 'connecting' }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${
      state === 'online' ? 'bg-emerald-400' :
      state === 'connecting' ? 'bg-amber-400 animate-pulse' :
      'bg-red-400'
    }`} />
  );
}

export default function Header({ status, sofiaState, clock }: Props) {
  const time = clock.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const date = clock.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const allOnline = Object.values(status).every((v) => v === 'online');

  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${STATE_COLOR[sofiaState]}`}>
          {STATE_LABEL[sofiaState]}
        </span>
        {sofiaState !== 'idle' && (
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-3 bg-blue-500 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <StatusDot state={status.camera} />
          <span>CAM</span>
          <StatusDot state={status.arm} />
          <span>BRAZO</span>
          <StatusDot state={status.xiaozhi} />
          <span className="flex items-center gap-0.5">
            <Cpu size={10} />MCP
          </span>
          <StatusDot state={status.gemini} />
          <span>AI</span>
        </div>

        {allOnline
          ? <Wifi size={16} className="text-emerald-500" />
          : <WifiOff size={16} className="text-red-400" />
        }

        <div className="flex items-center gap-1.5 text-right">
          <Clock size={14} className="text-gray-400" />
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-none">{time}</p>
            <p className="text-[10px] text-gray-400">{date}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
