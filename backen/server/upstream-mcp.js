const PROTOCOL_VERSION = '2024-11-05';
const REQUEST_TIMEOUT_MS = 30000;

function parseMessage(text, contentType, id) {
  if (contentType?.includes('text/event-stream')) {
    const payloads = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => JSON.parse(line.slice(5).trim()));
    return payloads.find((message) => message.id === id) ?? null;
  }
  return JSON.parse(text);
}

export class UpstreamMcpClient {
  constructor(url) {
    this.url = url;
    this.sessionId = null;
    this.nextId = 1;
  }

  get configured() {
    return Boolean(this.url);
  }

  async post(body, { expectResponse = true } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const response = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) this.sessionId = null;
    if (!response.ok) throw new Error(`El servidor MCP local respondió HTTP ${response.status}.`);

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) this.sessionId = sessionId;
    if (!expectResponse) return null;

    const message = parseMessage(await response.text(), response.headers.get('content-type'), body.id);
    if (!message) throw new Error('El servidor MCP local no devolvió una respuesta válida.');
    if (message.error) throw new Error(message.error.message ?? 'El servidor MCP local devolvió un error.');
    return message.result;
  }

  async initialize() {
    this.sessionId = null;
    await this.post({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'sofia-web-tools', version: '1.0.0' },
      },
    });
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { expectResponse: false });
  }

  async request(method, params) {
    if (!this.sessionId) await this.initialize();
    return this.post({ jsonrpc: '2.0', id: this.nextId++, method, params });
  }

  async listTools() {
    const result = await this.request('tools/list', {});
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  callTool(name, args) {
    return this.request('tools/call', { name, arguments: args });
  }
}
