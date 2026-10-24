import { useState } from 'react';
import { Wrench, Square, AlertTriangle, Loader2, Activity } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

const ARM_IP = '192.168.1.7';

type Props = {
  armStatus: 'online' | 'offline' | 'connecting';
  addLog: (type: 'arm', desc: string) => void;
};

type JointOption = { label: string; value: string };

const BASE_OPTIONS: JointOption[] = [
  { label: 'Izquierda', value: 'left' },
  { label: 'Derecha', value: 'right' },
  { label: 'Centro', value: 'center' },
];
const MIDDLE_OPTIONS: JointOption[] = [
  { label: 'Subir', value: 'up' },
  { label: 'Bajar', value: 'down' },
  { label: 'Medio', value: 'middle' },
];
const GRIPPER_OPTIONS: JointOption[] = [
  { label: 'Abrir', value: 'open' },
  { label: 'Cerrar', value: 'close' },
];

type ArmState = {
  base: string;
  middle: string;
  gripper: string;
};

async function callArm(path: string, body: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`http://${ARM_IP}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default function ArmPage({ armStatus, addLog }: Props) {
  const [joints, setJoints] = useState<ArmState>({ base: 'left', middle: 'up', gripper: 'open' });
  const [durations, setDurations] = useState([600, 600, 600]);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function executeMove() {
    setLoading(true);
    setError(null);
    setStatusText(null);
    const result = await callArm('/mover_articulaciones', { ...joints, durations });
    setLoading(false);
    if (result.ok) {
      const desc = `Brazo: base ${joints.base}, medio ${joints.middle}, pinza ${joints.gripper}`;
      addLog('arm', desc);
      setStatusText('Movimiento ejecutado correctamente');
    } else {
      setError('No se pudo conectar con el brazo en 192.168.1.7');
    }
  }

  async function stopServo(servo: string) {
    setStopping(true);
    const result = await callArm('/detener_servo', { servo });
    setStopping(false);
    if (result.ok) {
      addLog('arm', `Servo ${servo} detenido`);
      setStatusText(`Servo "${servo}" detenido`);
    } else {
      setError('Error al detener el servo');
    }
  }

  async function stopAll() {
    setStoppingAll(true);
    const result = await callArm('/detener_servos', {});
    setStoppingAll(false);
    if (result.ok) {
      addLog('arm', 'Todos los servos detenidos');
      setStatusText('Todos los servos detenidos');
    } else {
      setError('Error al detener los servos');
    }
  }

  async function getStatus() {
    const result = await callArm('/estado_brazo', {});
    if (result.ok) {
      addLog('arm', 'Estado del brazo consultado');
      setStatusText(JSON.stringify(result.data, null, 2));
    } else {
      setError('No se pudo obtener el estado del brazo');
    }
  }

  function setJoint(joint: keyof ArmState, value: string) {
    setJoints((prev) => ({ ...prev, [joint]: value }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Control del brazo robótico</h2>
          <p className="text-sm text-gray-500 mt-0.5">{ARM_IP}</p>
        </div>
        <StatusBadge state={armStatus} label={armStatus === 'online' ? 'En línea' : armStatus === 'connecting' ? 'Conectando' : 'Fuera de línea'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Movement control */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Wrench size={16} className="text-blue-500" />
            <h3 className="font-semibold text-gray-800">Movimiento coordinado</h3>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Base', key: 'base' as const, options: BASE_OPTIONS },
              { label: 'Medio', key: 'middle' as const, options: MIDDLE_OPTIONS },
              { label: 'Pinza', key: 'gripper' as const, options: GRIPPER_OPTIONS },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{label}</label>
                <div className="grid grid-cols-3 gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setJoint(key, opt.value)}
                      className={`py-2.5 text-sm rounded-xl font-medium border transition-all ${
                        joints[key] === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Durations */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Duración (ms)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Base', 'Medio', 'Pinza'].map((lbl, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-gray-400 mb-1">{lbl}</p>
                    <input
                      type="number"
                      min={100}
                      max={3000}
                      step={100}
                      value={durations[i]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 600;
                        setDurations((prev) => { const next = [...prev]; next[i] = val; return next; });
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Execute button */}
          <button
            onClick={executeMove}
            disabled={loading || armStatus === 'offline'}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
            {loading ? 'Ejecutando...' : 'Ejecutar movimiento'}
          </button>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <button
              onClick={() => stopServo(joints.base === 'left' ? 'base' : joints.base)}
              disabled={stopping}
              className="flex flex-col items-center gap-1.5 py-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {stopping ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
              Detener servo
            </button>
            <button
              onClick={stopAll}
              disabled={stoppingAll}
              className="flex flex-col items-center gap-1.5 py-3 bg-amber-50 text-amber-600 rounded-xl text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {stoppingAll ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
              Detener todos
            </button>
            <button
              onClick={getStatus}
              className="flex flex-col items-center gap-1.5 py-3 bg-violet-50 text-violet-600 rounded-xl text-xs font-medium hover:bg-violet-100 transition-colors"
            >
              <Activity size={16} />
              Estado
            </button>
          </div>
        </div>

        {/* Status panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-sm text-gray-800 mb-3">Estado actual</p>
            <div className="space-y-2">
              {[
                { label: 'Base', value: joints.base },
                { label: 'Articulación media', value: joints.middle },
                { label: 'Pinza', value: joints.gripper },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800 capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {statusText && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Respuesta del brazo</p>
              <pre className="text-xs text-emerald-600 whitespace-pre-wrap break-all">{statusText}</pre>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 rounded-2xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Endpoint del brazo</p>
            <p className="font-mono break-all">{`http://${ARM_IP}/`}</p>
            <p className="text-blue-500 mt-1">Asegúrate de que el ESP32 esté conectado a la misma red.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
