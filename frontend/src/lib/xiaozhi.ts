// XiaoZhi MCP WebSocket client — JSON-RPC 2.0 over WebSocket

// Token from the user (spaces removed from original copy-paste)
const XIAOZHI_TOKEN =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJ1c2VySWQiOjExMzI2NjEsImFnZW50SWQiOjI1NDQ3MDUsImVuZHBvaW50SWQiOiJhZ2VudF8yNTQ0NzA1IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc5Mjg2OTc3OSwiZXhwIjoxODI0NDI3Mzc5fQ.' +
  'ijXr3gcKjn5Q9hJumCY4fClDIfXbAsXoEsyBqLktPXYIAoho7DNwbblOyuZ5ibFyc3Co4ikLOHbVz0s40Mt5Cw';

export const XIAOZHI_WS_URL = `wss://api.xiaozhi.me/mcp/?token=${XIAOZHI_TOKEN}`;

export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
};

export type McpToolResult = {
  content: { type: string; text?: string }[];
  isError?: boolean;
};

type RpcRequest = {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
};

type RpcResponse = {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
};

type PendingCall = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
};

export class XiaoZhiMcpClient {
  private ws: WebSocket | null = null;
  private idCounter = 1;
  private pending = new Map<number, PendingCall>();
  private onStateChange: (s: McpConnectionState) => void;
  private onNotification: (method: string, params: unknown) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    onStateChange: (s: McpConnectionState) => void,
    onNotification: (method: string, params: unknown) => void,
  ) {
    this.onStateChange = onStateChange;
    this.onNotification = onNotification;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.onStateChange('connecting');

    try {
      this.ws = new WebSocket(XIAOZHI_WS_URL);
    } catch {
      this.onStateChange('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.initialize().catch(() => this.onStateChange('error'));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: RpcResponse = JSON.parse(event.data as string);
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            if (msg.error) pending.reject(new Error(msg.error.message));
            else pending.resolve(msg.result);
          }
        } else if ((msg as unknown as RpcRequest).method) {
          const req = msg as unknown as RpcRequest;
          this.onNotification(req.method, req.params);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      this.onStateChange('error');
    };

    this.ws.onclose = () => {
      // Reject all pending calls
      this.pending.forEach((p) => p.reject(new Error('WebSocket closed')));
      this.pending.clear();
      if (!this.destroyed) {
        this.onStateChange('disconnected');
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, 5000);
  }

  private send(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const id = this.idCounter++;
      this.pending.set(id, { resolve, reject });
      const msg: RpcRequest = { jsonrpc: '2.0', id, method, params };
      this.ws.send(JSON.stringify(msg));

      // Timeout after 15 s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 15_000);
    });
  }

  private async initialize() {
    try {
      await this.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { roots: {}, sampling: {} },
        clientInfo: { name: 'Sofia Dashboard', version: '1.0.0' },
      });
      // Send initialized notification (no id = notification)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
      }
      this.onStateChange('connected');
    } catch {
      this.onStateChange('error');
      this.scheduleReconnect();
    }
  }

  async listTools(): Promise<McpTool[]> {
    try {
      const result = await this.send('tools/list', {}) as { tools?: McpTool[] };
      return result?.tools ?? [];
    } catch {
      return [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.send('tools/call', { name, arguments: args }) as McpToolResult;
    return result;
  }

  // Sends a chat message — uses a "chat" tool if available, or a direct sampling call
  async chat(message: string): Promise<string> {
    try {
      // Try calling a chat/message tool first
      const result = await this.callTool('chat', { message });
      const text = result?.content?.find((c) => c.type === 'text')?.text;
      if (text) return text;

      // Fallback: try 'ask' or 'query'
      const result2 = await this.callTool('ask', { query: message });
      const text2 = result2?.content?.find((c) => c.type === 'text')?.text;
      if (text2) return text2;

      return 'Recibido. (Herramienta de chat no encontrada en el agente XiaoZhi.)';
    } catch (e) {
      throw new Error((e as Error).message);
    }
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.pending.forEach((p) => p.reject(new Error('Disconnected')));
    this.pending.clear();
  }
}
