export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type McpTool = {
  name: string;
  description?: string;
};
