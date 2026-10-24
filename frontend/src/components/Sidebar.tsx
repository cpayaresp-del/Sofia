import {
  Home,
  Camera,
  Wrench,
  Settings,
  Music,
  MessageSquare,
  Bot,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Page } from '@/types';
import type { SystemStatus } from '@/types';

type Props = {
  current: Page;
  onNavigate: (page: Page) => void;
  status: SystemStatus;
};

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'camera', label: 'Cámara', icon: Camera },
  { id: 'arm', label: 'Brazo Robótico', icon: Wrench },
  { id: 'music', label: 'Música', icon: Music },
  { id: 'chat', label: 'Chat y Voz', icon: MessageSquare },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

function allOnline(s: SystemStatus) {
  return Object.values(s).every((v) => v === 'online');
}

export default function Sidebar({ current, onNavigate, status }: Props) {
  const online = allOnline(status);

  return (
    <aside className="flex flex-col w-64 min-w-[256px] bg-[#0f1729] text-white h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Bot size={22} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-lg leading-tight tracking-wide">Sofía</p>
          <p className="text-xs text-blue-300/80">Tu asistente inteligente</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="px-4 pb-4">
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
          online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}>
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          <div>
            <p className="text-xs font-semibold">{online ? 'Todo en línea' : 'Conexión parcial'}</p>
            <p className="text-[10px] opacity-70">{online ? 'Sofía está lista' : 'Revisa los dispositivos'}</p>
          </div>
        </div>
        <p className="text-center text-[10px] text-white/25 mt-3">Tecnología con propósito — Sofía</p>
      </div>
    </aside>
  );
}
