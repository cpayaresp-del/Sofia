export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  type: 'camera' | 'arm' | 'chat' | 'music' | 'system';
  description: string;
  created_at: string;
};

export type McpStatus = {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  tools: { name: string; description?: string }[];
};

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export const api = {
  mcp: {
    status: () => request<McpStatus>('/mcp/status'),
  },
  chat: {
    list: (limit = 50) => request<ChatMessage[]>(`/chat-messages?limit=${limit}`),
    create: (message: Omit<ChatMessage, 'id'>) => request<ChatMessage>('/chat-messages', {
      method: 'POST',
      body: JSON.stringify(message),
    }),
    clear: () => request<{ deleted: number }>('/chat-messages', { method: 'DELETE' }),
  },
  activity: {
    list: (limit = 20) => request<ActivityLog[]>(`/activity-logs?limit=${limit}`),
    create: (log: Pick<ActivityLog, 'type' | 'description'>) => request<ActivityLog>('/activity-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    }),
  },
};