import WebSocket from 'ws';
import { searchWeb } from './web-search.js';

const PROTOCOL_VERSION = '2024-11-05';
const RECONNECT_DELAY_MS = 5000;
const CONNECT_TIMEOUT_MS = 15000;

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

function describeConnectionError(error, token) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = message
    .replaceAll(token, '[token oculto]')
    .replaceAll(encodeURIComponent(token), '[token oculto]');
  return [code, safeMessage].filter(Boolean).join(': ') || 'desconocido';
}

export class XiaoZhiMcpBridge {
  constructor({ getDatabase }) {
    this.tools = {
      buscar_en_internet: {
        description: 'Busca información reciente en Internet y resume los resultados con sus enlaces.',
        inputSchema: {
          type: 'object',
          properties: { consulta: { type: 'string', description: 'Qué información necesitas buscar.' } },
          required: ['consulta'],
        },
        handler: (args) => this.searchWeb(args),
      },
      buscar_en_youtube: {
        description: 'Busca videos y música en YouTube y devuelve sus enlaces.',
        inputSchema: {
          type: 'object',
          properties: {
            consulta: {
              type: 'string',
              maxLength: 270,
              description: 'Qué video o canción quieres buscar.',
            },
          },
          required: ['consulta'],
        },
        handler: (args) => this.searchYouTube(args),
      },
    };
    this.getDatabase = getDatabase;
    this.state = process.env.XIAOZHI_MCP_TOKEN ? 'disconnected' : 'error';
    this.lastError = process.env.XIAOZHI_MCP_TOKEN ? null : 'Falta XIAOZHI_MCP_TOKEN en las variables de entorno.';
    this.socket = null;
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.stopped = false;
  }

  status() {
    return {
      state: this.state,
      error: this.lastError,
      tools: Object.entries(this.tools).map(([name, tool]) => ({ name, description: tool.description })),
    };
  }

  connect() {
    if (this.stopped || !process.env.XIAOZHI_MCP_TOKEN) {
      if (!process.env.XIAOZHI_MCP_TOKEN) {
        console.error(this.lastError);
      }
      return;
    }
    if (this.socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(this.socket.readyState)) return;

    this.state = 'connecting';
    this.lastError = null;
    const endpoint = `wss://api.xiaozhi.me/mcp/?token=${encodeURIComponent(process.env.XIAOZHI_MCP_TOKEN)}`;
    try {
      this.socket = new WebSocket(endpoint);
    } catch (error) {
      this.state = 'error';
      const details = describeConnectionError(error, process.env.XIAOZHI_MCP_TOKEN);
      this.lastError = `No se pudo abrir la conexión MCP: ${details}`;
      console.error(this.lastError);
      this.scheduleReconnect();
      return;
    }

    this.socket.on('open', () => {
      if (this.connectionTimer) clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
      this.state = 'connected';
      this.lastError = null;
      console.log('Conexión WebSocket con XiaoZhi establecida; esperando solicitudes MCP.');
    });
    this.socket.on('message', (data) => {
      this.handleMessage(data).catch((error) => {
        console.error('Error procesando solicitud MCP:', error);
      });
    });
    this.socket.on('error', (error) => {
      if (this.connectionTimer) clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
      this.state = 'error';
      const details = describeConnectionError(error, process.env.XIAOZHI_MCP_TOKEN);
      this.lastError = `Error de conexión MCP: ${details}`;
      console.error(this.lastError);
      this.socket?.close();
    });
    this.socket.on('close', (code, reason) => {
      if (this.connectionTimer) clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
      this.socket = null;
      if (!this.stopped) {
        if (this.state !== 'error') {
          const closeReason = reason.toString().trim();
          this.state = 'disconnected';
          this.lastError = `Conexión MCP cerrada (código ${code}${closeReason ? `: ${closeReason}` : ''}).`;
        }
        this.scheduleReconnect();
      }
    });
    this.connectionTimer = setTimeout(() => {
      if (this.socket?.readyState === WebSocket.CONNECTING) {
        this.state = 'error';
        this.lastError = 'La conexión MCP agotó el tiempo de espera.';
        this.socket.terminate();
      }
    }, CONNECT_TIMEOUT_MS);
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  async searchWeb(args) {
    const query = typeof args.consulta === 'string' ? args.consulta.trim() : '';
    const results = await searchWeb(query);
    return textResult(formatResults(results));
  }

  async searchYouTube(args) {
    const query = typeof args.consulta === 'string' ? args.consulta.trim() : '';
    if (!query) throw new Error('Escribe qué video o canción quieres buscar.');
    if (query.length > 270) throw new Error('La búsqueda de YouTube no puede superar los 270 caracteres.');
    const results = await searchWeb(`site:youtube.com/watch ${query}`);
    return textResult(formatResults(results));
  }

  async handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      console.error('XiaoZhi envió un mensaje MCP con JSON inválido.');
      return;
    }

    function formatResults(results) {
      if (results.length === 0) return 'No se encontraron resultados.';
      return results.map((result, index) =>
        `${index + 1}. ${result.title}\n${result.snippet}\n${result.url}`,
      ).join('\n\n');
    }
    if (Array.isArray(message)) {
      for (const item of message) await this.handleRequest(item);
      return;
    }
    if (!message || typeof message.method !== 'string') return;
    await this.handleRequest(message);
  }

  async handleRequest(message) {
    if (typeof message.method !== 'string') return;
    if (message.method === 'notifications/initialized' || message.method.startsWith('notifications/')) return;
    if (message.id === undefined || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    if (message.method === 'initialize') {
      this.send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'sofia-web-tools', version: '1.0.0' },
        },
      });
      return;
    }

    if (message.method === 'tools/list') {
      this.send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: Object.entries(this.tools).map(([name, tool]) => ({
            name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        },
      });
      return;
    }

    if (message.method === 'tools/call') {
      await this.handleToolCall(message);
      return;
    }

    this.send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Método MCP no soportado: ${message.method}` },
    });
  }

  async handleToolCall(message) {
    const { name, arguments: args = {} } = message.params ?? {};
    const tool = this.tools[name];
    if (!tool) {
      this.send({
        jsonrpc: '2.0',
        id: message.id,
        result: textResult(`Herramienta no disponible: ${String(name)}`, true),
      });
      return;
    }

    try {
      const result = await tool.handler(args, { getDatabase: this.getDatabase });
      this.send({ jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Error al ejecutar la herramienta.';
      this.send({
        jsonrpc: '2.0',
        id: message.id,
        result: textResult(messageText, true),
      });
    }
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.socket?.close();
    this.socket = null;
  }
}
