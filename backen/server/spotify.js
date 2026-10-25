import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';

const TOKEN_ID = 'spotify';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

function spotifyConfig() {
  const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret, SPOTIFY_REDIRECT_URI: redirectUri } = process.env;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configura SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET y SPOTIFY_REDIRECT_URI en Render.');
  }
  return { clientId, clientSecret, redirectUri };
}

function encryptionKey() {
  const encoded = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error('Falta SPOTIFY_TOKEN_ENCRYPTION_KEY en Render.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('SPOTIFY_TOKEN_ENCRYPTION_KEY debe ser una clave base64 de 32 bytes.');
  return key;
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value) {
  const [ivPart, tagPart, encryptedPart] = value.split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('El token almacenado de Spotify no es válido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function cookieValue(request, name) {
  const prefix = `${name}=`;
  const item = request.headers.cookie?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function sameState(expected, received) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function spotifyTokenRequest(body, clientId, clientSecret) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Spotify OAuth respondió HTTP ${response.status}. Revisa el Client ID, el secreto y la Redirect URI.`);
  return result;
}

async function storeRefreshToken(getDatabase, refreshToken) {
  await (await getDatabase()).collection('integrations').updateOne(
    { _id: TOKEN_ID },
    { $set: { refresh_token_encrypted: encrypt(refreshToken), updated_at: new Date().toISOString() } },
    { upsert: true },
  );
}

export function createSpotifyRouter({ getDatabase }) {
  const router = Router();

  router.get('/auth', (_request, response, next) => {
    try {
      const { clientId, redirectUri } = spotifyConfig();
      const state = randomBytes(32).toString('hex');
      response.cookie('spotify_oauth_state', state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/api/spotify/callback',
      });
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: SCOPES,
        state,
      });
      response.redirect(`https://accounts.spotify.com/authorize?${params}`);
    } catch (error) {
      next(error);
    }
  });

  router.get('/callback', async (request, response, next) => {
    response.clearCookie('spotify_oauth_state', { secure: true, sameSite: 'lax', path: '/api/spotify/callback' });
    try {
      const { clientId, clientSecret, redirectUri } = spotifyConfig();
      const expectedState = cookieValue(request, 'spotify_oauth_state');
      if (typeof request.query.state !== 'string' || !sameState(expectedState, request.query.state)) {
        return response.status(400).send('La autorización de Spotify no superó la verificación de estado. Vuelve a iniciarla desde Configuración.');
      }
      if (typeof request.query.code !== 'string') {
        return response.status(400).send('Spotify no devolvió un código de autorización.');
      }

      const tokens = await spotifyTokenRequest({
        grant_type: 'authorization_code',
        code: request.query.code,
        redirect_uri: redirectUri,
      }, clientId, clientSecret);
      if (typeof tokens.refresh_token !== 'string') {
        throw new Error('Spotify no devolvió un refresh token. Revoca el acceso de la aplicación e inténtalo de nuevo.');
      }
      await storeRefreshToken(getDatabase, tokens.refresh_token);
      response.redirect(`${(process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/+$/, '')}/?spotifyMcp=connected`);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function accessToken(getDatabase) {
  const { clientId, clientSecret } = spotifyConfig();
  const integration = await (await getDatabase()).collection('integrations').findOne({ _id: TOKEN_ID });
  if (!integration?.refresh_token_encrypted) {
    throw new Error('Spotify no está autorizado para XiaoZhi. Abre Configuración y pulsa "Autorizar Spotify para XiaoZhi".');
  }
  const refreshToken = decrypt(integration.refresh_token_encrypted);
  const tokens = await spotifyTokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }, clientId, clientSecret);
  if (tokens.refresh_token) await storeRefreshToken(getDatabase, tokens.refresh_token);
  return tokens.access_token;
}

async function spotifyApi(getDatabase, path, options) {
  const token = await accessToken(getDatabase);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options?.headers },
  });
  if (response.status === 204) return { response, data: null };
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = response.status === 404
      ? 'No hay un dispositivo Spotify activo. Abre Spotify en un dispositivo e inténtalo de nuevo.'
      : `Spotify respondió HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return { response, data };
}

function toolText(text) {
  return { content: [{ type: 'text', text }], isError: false };
}

export function createSpotifyTools() {
  return {
    buscar_spotify: {
      description: 'Busca canciones en Spotify y devuelve nombres, artistas y URI de reproducción.',
      inputSchema: {
        type: 'object',
        properties: { consulta: { type: 'string', description: 'Nombre de la canción, artista o álbum.' } },
        required: ['consulta'],
      },
      handler: async (args, { getDatabase }) => {
        const query = typeof args.consulta === 'string' ? args.consulta.trim() : '';
        if (!query || query.length > 200) throw new Error('La consulta debe tener entre 1 y 200 caracteres.');
        const { data } = await spotifyApi(getDatabase, `/search?${new URLSearchParams({ q: query, type: 'track', limit: '5' })}`);
        const tracks = data?.tracks?.items ?? [];
        if (!tracks.length) return toolText('No encontré canciones con esa búsqueda.');
        return toolText(tracks.map((track, index) =>
          `${index + 1}. ${track.name} — ${track.artists.map((artist) => artist.name).join(', ')} (URI: ${track.uri})`,
        ).join('\n'));
      },
    },
    reproducir_spotify: {
      description: 'Busca una canción por nombre y la reproduce en el dispositivo Spotify activo.',
      inputSchema: {
        type: 'object',
        properties: { consulta: { type: 'string', description: 'Canción o artista que quieres reproducir.' } },
        required: ['consulta'],
      },
      handler: async (args, { getDatabase }) => {
        const query = typeof args.consulta === 'string' ? args.consulta.trim() : '';
        if (!query || query.length > 200) throw new Error('La consulta debe tener entre 1 y 200 caracteres.');
        const { data: search } = await spotifyApi(getDatabase, `/search?${new URLSearchParams({ q: query, type: 'track', limit: '1' })}`);
        const track = search?.tracks?.items?.[0];
        if (!track) return toolText('No encontré una canción para reproducir.');
        await spotifyApi(getDatabase, '/me/player/play', {
          method: 'PUT',
          body: JSON.stringify({ uris: [track.uri] }),
        });
        return toolText(`Reproduciendo ${track.name} — ${track.artists.map((artist) => artist.name).join(', ')}.`);
      },
    },
    control_spotify: {
      description: 'Controla Spotify: pausar, reanudar, siguiente o anterior.',
      inputSchema: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['pausar', 'reanudar', 'siguiente', 'anterior'] },
        },
        required: ['accion'],
      },
      handler: async (args, { getDatabase }) => {
        const paths = {
          pausar: ['/me/player/pause', 'PUT'],
          reanudar: ['/me/player/play', 'PUT'],
          siguiente: ['/me/player/next', 'POST'],
          anterior: ['/me/player/previous', 'POST'],
        };
        const action = paths[args.accion];
        if (!action) throw new Error('Acción no válida. Usa pausar, reanudar, siguiente o anterior.');
        await spotifyApi(getDatabase, action[0], { method: action[1] });
        return toolText(`Acción de Spotify ejecutada: ${args.accion}.`);
      },
    },
  };
}
