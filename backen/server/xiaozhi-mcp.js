import WebSocket from 'ws';

const PROTOCOL_VERSION = '2024-11-05';
const RECONNECT_DELAY_MS = 5000;
const CONNECT_TIMEOUT_MS = 15000;
const SEARCH_URL = 'https://api.tavily.com/search';

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

export class XiaoZhiMcpBridge {
  constructor({ tools, searchApiKey, getDatabase }) {
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
      ...tools,
    };
    this.searchApiKey = searchApiKey;
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
      this.lastError = 'No se pudo abrir la conexión MCP. Revisa el token y los logs de Render.';
      console.error('No se pudo abrir la conexión con XiaoZhi MCP:', this.lastError);
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
      this.lastError = 'Error en la conexión MCP. Revisa el token y los logs de Render.';
      console.error('Error de conexión con XiaoZhi MCP:', error.code ?? 'desconocido');
      this.socket?.close();
    });
    this.socket.on('close', (code) => {
      if (this.connectionTimer) clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
      this.socket = null;
      if (!this.stopped) {
        this.state = 'disconnected';
        this.lastError = `Conexión MCP cerrada (código ${code}).`;
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
    if (!query || query.length > 300) throw new Error('La consulta debe tener entre 1 y 300 caracteres.');
    if (!this.searchApiKey) throw new Error('La búsqueda web no está configurada. Añade TAVILY_API_KEY en Render.');

    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.searchApiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
    });
    if (!response.ok) throw new Error(`El proveedor de búsqueda respondió HTTP ${response.status}.`);
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const answer = typeof data.answer === 'string' ? `${data.answer}\n\n` : '';
    const links = results.map((result, index) =>
      `${index + 1}. ${result.title ?? 'Resultado'}\n${result.content ?? ''}\n${result.url ?? ''}`,
    ).join('\n\n');
    return textResult(answer + (links || 'No se encontraron resultados.'));
  }

  async handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      console.error('XiaoZhi envió un mensaje MCP con JSON inválido.');
      return;
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
