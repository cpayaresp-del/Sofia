import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import type { McpConnectionState, McpTool } from '@/lib/xiaozhi';

export type { McpConnectionState, McpTool };

export function useXiaoZhi() {
  const [state, setState] = useState<McpConnectionState>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const status = await api.mcp.status();
        if (!active) return;
        setState(status.state);
        setTools(status.tools);
        setError(status.error);
      } catch (err) {
        if (!active) return;
        setState('error');
        setError(err instanceof Error ? err.message : 'No se pudo consultar el estado MCP.');
      }
    };
    void refresh();
    refreshTimerRef.current = setInterval(refresh, 10_000);
    return () => {
      active = false;
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  const chat = useCallback((message: string): Promise<string> => {
    void message;
    return Promise.reject(
      new Error('La conexión MCP comparte herramientas con XiaoZhi; no es una API de conversación. Inicia el chat desde XiaoZhi.'),
    );
  }, []);

  return { state, tools, error, chat };
}
