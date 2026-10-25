import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Trash2, Bot, User, Volume2, VolumeX, Loader2, Cpu, AlertTriangle } from 'lucide-react';
import { api, type ChatMessage } from '@/lib/api';
import type { SofiaState } from '@/types';
import type { McpConnectionState } from '@/hooks/useXiaoZhi';

type Props = {
  setSofiaState: (s: SofiaState) => void;
  addLog: (type: 'chat', desc: string) => void;
  xiaozhiChat: (message: string) => Promise<string>;
  xiaozhiState: McpConnectionState;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const MCP_STATE_LABEL: Record<McpConnectionState, string> = {
  connected: 'Herramientas conectadas con XiaoZhi',
  connecting: 'Conectando herramientas con XiaoZhi...',
  disconnected: 'XiaoZhi desconectado',
  error: 'Error de conexión MCP',
};

const MCP_STATE_COLOR: Record<McpConnectionState, string> = {
  connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  connecting: 'bg-amber-50 text-amber-700 border-amber-200',
  disconnected: 'bg-gray-50 text-gray-500 border-gray-200',
  error: 'bg-red-50 text-red-600 border-red-200',
};

export default function ChatPage({ setSofiaState, addLog, xiaozhiChat, xiaozhiState }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => { loadMessages(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadMessages() {
    try {
      const data = await api.chat.list(50);
      if (data.length > 0) {
        setMessages(data);
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: '¡Hola! Soy Sofía, conectada a XiaoZhi MCP. ¿Qué te gustaría hacer hoy?',
          created_at: new Date().toISOString(),
        }]);
      }
    } catch {
      setError('No se pudo conectar con el backend. Comprueba que el servidor esté ejecutándose.');
    }
  }

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || muted) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'es-ES';
      utter.rate = 0.95;
      utter.onstart = () => setSofiaState('speaking');
      utter.onend = () => setSofiaState('idle');
      window.speechSynthesis.speak(utter);
    }
  }, [ttsEnabled, muted, setSofiaState]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    setError(null);
    setLoading(true);
    setSofiaState('thinking');

    const userMsg: Omit<ChatMessage, 'id'> = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const inserted = await api.chat.create(userMsg);
    setMessages((prev) => [...prev, inserted]);

    let reply: string;
    try {
      if (xiaozhiState === 'connected') {
        reply = await xiaozhiChat(text);
      } else {
        reply = `XiaoZhi MCP está ${xiaozhiState === 'connecting' ? 'conectando' : 'fuera de línea'}. Espera un momento e intenta de nuevo.`;
      }
    } catch (e) {
      reply = `Error al comunicarse con XiaoZhi: ${(e as Error).message}`;
      setError(reply);
    }

    const assistantMsg: Omit<ChatMessage, 'id'> = {
      role: 'assistant',
      content: reply,
      created_at: new Date().toISOString(),
    };

    const insertedAssistant = await api.chat.create(assistantMsg);
    setMessages((prev) => [...prev, insertedAssistant]);
    speak(reply);

    addLog('chat', `Mensaje: "${text.slice(0, 60)}"`);
    setLoading(false);
    setSofiaState('idle');
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR() as SpeechRecognitionLike;
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => sendMessage(e.results[0][0].transcript);
    rec.onend = () => { setListening(false); setSofiaState('idle'); };
    rec.onerror = () => { setListening(false); setSofiaState('idle'); };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setSofiaState('listening');
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setSofiaState('idle');
  }

  async function clearHistory() {
    await api.chat.clear();
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy Sofía, conectada a XiaoZhi MCP. ¿Qué te gustaría hacer hoy?',
      created_at: new Date().toISOString(),
    }]);
  }

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-57px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Chat y Voz</h2>
          <p className="text-sm text-gray-500 mt-0.5">MCP comparte herramientas con XiaoZhi; no es un canal de conversación.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              ttsEnabled ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {ttsEnabled ? 'Voz activa' : 'Voz off'}
          </button>
          <button
            onClick={() => setMuted((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              muted ? 'bg-red-50 text-red-500 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {muted ? <MicOff size={13} /> : <Mic size={13} />}
            {muted ? 'Silenciado' : 'Audio'}
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Trash2 size={13} />
            Limpiar
          </button>
        </div>
      </div>

      {/* XiaoZhi MCP status bar */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium mb-3 flex-shrink-0 ${MCP_STATE_COLOR[xiaozhiState]}`}>
        <Cpu size={13} />
        <span>{MCP_STATE_LABEL[xiaozhiState]}</span>
        {xiaozhiState === 'connecting' && <Loader2 size={11} className="animate-spin ml-auto" />}
        {xiaozhiState === 'connected' && (
          <span className="ml-auto flex items-center gap-1 opacity-70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En línea
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Cuando la conexión esté activa, pide al agente XiaoZhi que busque información o controle Spotify. Esta página no envía mensajes de chat al agente.
      </p>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700 mb-3 flex-shrink-0">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-100 p-4 space-y-4 mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-blue-600' : 'bg-gray-200'
            }`}>
              {msg.role === 'assistant' ? <Bot size={14} className="text-white" /> : <User size={14} className="text-gray-600" />}
            </div>
            <div className={`max-w-[72%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant' ? 'bg-gray-100 text-gray-800' : 'bg-blue-600 text-white'
              }`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-gray-100 px-4 py-3 rounded-2xl flex items-center gap-2">
              <Cpu size={12} className="text-blue-400 animate-spin" />
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            listening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600'
          }`}
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={
            xiaozhiState === 'connected'
              ? 'El chat de texto no está disponible por MCP'
              : xiaozhiState === 'connecting'
              ? 'Conectando con XiaoZhi...'
              : 'XiaoZhi desconectado — revisa la red'
          }
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
