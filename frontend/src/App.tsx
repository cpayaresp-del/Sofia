import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Home from '@/pages/Home';
import CameraPage from '@/pages/Camera';
import ArmPage from '@/pages/RoboticArm';
import MusicPage from '@/pages/Music';
import ChatPage from '@/pages/Chat';
import SettingsPage from '@/pages/Settings';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useXiaoZhi } from '@/hooks/useXiaoZhi';
import type { Page, SofiaState, SystemStatus } from '@/types';

function mcpToStatus(s: string): SystemStatus['xiaozhi'] {
  if (s === 'connected') return 'online';
  if (s === 'connecting') return 'connecting';
  return 'offline';
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [sofiaState, setSofiaState] = useState<SofiaState>('idle');
  const { status: hwStatus, refresh } = useSystemStatus();
  const { logs, addLog } = useActivityLog();
  const { state: xiaozhiState, tools, chat: xiaozhiChat } = useXiaoZhi();
  const [clock, setClock] = useState(new Date());

  // Re-render clock every minute for header
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const status: SystemStatus = {
    ...hwStatus,
    mcp: mcpToStatus(xiaozhiState),
    xiaozhi: mcpToStatus(xiaozhiState),
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar current={page} onNavigate={setPage} status={status} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header status={status} sofiaState={sofiaState} clock={clock} />

        <main className="flex-1 overflow-y-auto">
          {page === 'home' && (
            <Home
              status={status}
              sofiaState={sofiaState}
              logs={logs}
              onNavigate={setPage}
              mcpTools={tools}
            />
          )}
          {page === 'camera' && (
            <CameraPage cameraStatus={status.camera} addLog={(type, desc) => addLog(type, desc)} />
          )}
          {page === 'arm' && (
            <ArmPage armStatus={status.arm} addLog={(type, desc) => addLog(type, desc)} />
          )}
          {page === 'music' && (
            <MusicPage addLog={(type, desc) => addLog(type, desc)} />
          )}
          {page === 'chat' && (
            <ChatPage
              setSofiaState={setSofiaState}
              addLog={(type, desc) => addLog(type, desc)}
              xiaozhiChat={xiaozhiChat}
              xiaozhiState={xiaozhiState}
            />
          )}
          {page === 'settings' && (
            <SettingsPage onRefreshStatus={refresh} xiaozhiState={xiaozhiState} />
          )}
        </main>

        <footer className="py-2.5 text-center text-[11px] text-gray-400 border-t border-gray-100 bg-white">
          Sofía &nbsp;·&nbsp; Cámara + Brazo Robótico + IA &nbsp;·&nbsp; Siempre contigo &nbsp;♡
        </footer>
      </div>
    </div>
  );
}
