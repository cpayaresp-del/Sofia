import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { MongoClient } from 'mongodb';
import { searchWeb } from './web-search.js';
import { XiaoZhiMcpBridge } from './xiaozhi-mcp.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const mongoClient = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');
const databaseName = process.env.MONGODB_DB ?? 'sofia';
let database;

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }));
app.use(express.json());

async function getDatabase() {
  if (!database) {
    await mongoClient.connect();
    database = mongoClient.db(databaseName);
  }
  return database;
}

function serialize(document) {
  return { ...document, id: document._id.toString(), _id: undefined };
}

function limitFrom(request) {
  return Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
}

const mcp = new XiaoZhiMcpBridge({
  getDatabase,
});
app.get('/api/mcp/status', (_request, response) => response.json(mcp.status()));

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

app.get('/api/search', async (request, response, next) => {
  try {
    const query = typeof request.query.q === 'string' ? request.query.q : '';
    if (!query.trim() || query.length > 300) {
      return response.status(400).json({ error: 'La consulta debe tener entre 1 y 300 caracteres.' });
    }
    response.json({ results: await searchWeb(query) });
  } catch (error) { next(error); }
});

app.get('/api/chat-messages', async (request, response, next) => {
  try {
    const messages = await (await getDatabase()).collection('chat_messages')
      .find().sort({ created_at: 1 }).limit(limitFrom(request)).toArray();
    response.json(messages.map(serialize));
  } catch (error) { next(error); }
});

app.post('/api/chat-messages', async (request, response, next) => {
  try {
    const { role, content, created_at } = request.body;
    if (!['user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim()) {
      return response.status(400).json({ error: 'role y content son obligatorios' });
    }
    const message = { role, content: content.trim(), created_at: created_at ?? new Date().toISOString() };
    const result = await (await getDatabase()).collection('chat_messages').insertOne(message);
    response.status(201).json(serialize({ ...message, _id: result.insertedId }));
  } catch (error) { next(error); }
});

app.delete('/api/chat-messages', async (_request, response, next) => {
  try {
    const result = await (await getDatabase()).collection('chat_messages').deleteMany({});
    response.json({ deleted: result.deletedCount });
  } catch (error) { next(error); }
});

app.get('/api/activity-logs', async (request, response, next) => {
  try {
    const logs = await (await getDatabase()).collection('activity_log')
      .find().sort({ created_at: -1 }).limit(limitFrom(request)).toArray();
    response.json(logs.map(serialize));
  } catch (error) { next(error); }
});

app.post('/api/activity-logs', async (request, response, next) => {
  try {
    const { type, description } = request.body;
    if (!['camera', 'arm', 'chat', 'music', 'system'].includes(type) || typeof description !== 'string') {
      return response.status(400).json({ error: 'type y description son obligatorios' });
    }
    const log = { type, description, created_at: new Date().toISOString() };
    const result = await (await getDatabase()).collection('activity_log').insertOne(log);
    response.status(201).json(serialize({ ...log, _id: result.insertedId }));
  } catch (error) { next(error); }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(port, () => console.log(`API MongoDB escuchando en http://localhost:${port}`));
mcp.connect();

async function shutdown() {
  mcp.disconnect();
  await mongoClient.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);