import { useState, useEffect, useRef, useCallback } from 'react';
import { XiaoZhiMcpClient, type McpConnectionState, type McpTool } from '@/lib/xiaozhi';

export type { McpConnectionState, McpTool };

export function useXiaoZhi() {
  const [state, setState] = useState<McpConnectionState>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const clientRef = useRef<XiaoZhiMcpClient | null>(null);

  useEffect(() => {
    const client = new XiaoZhiMcpClient(
      (newState) => {
        setState(newState);
        if (newState === 'connected') {
          client.listTools().then(setTools);
        }
      },
      () => {
        // Handle server-push notifications if needed
      },
    );
    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const chat = useCallback(async (message: string): Promise<string> => {
    const client = clientRef.current;
    if (!client) throw new Error('MCP client not initialized');
    return client.chat(message);
  }, []);

  const callTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    const client = clientRef.current;
    if (!client) throw new Error('MCP client not initialized');
    return client.callTool(name, args);
  }, []);

  return { state, tools, chat, callTool };
}
