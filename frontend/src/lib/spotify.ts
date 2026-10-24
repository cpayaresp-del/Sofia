// Spotify PKCE OAuth flow — no Client Secret needed for browser apps

export const SPOTIFY_CLIENT_ID = '01b365ecac35485b9956ccace6e85d5b';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'user-top-read',
].join(' ');

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

// --- PKCE helpers ---
function generateCodeVerifier(length = 128): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Auth ---
export async function startSpotifyLogin() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem('spotify_code_verifier', verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const verifier = localStorage.getItem('spotify_code_verifier');
  if (!verifier) return false;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  saveTokens(data);
  localStorage.removeItem('spotify_code_verifier');
  // Remove code from URL
  window.history.replaceState({}, '', window.location.pathname);
  return true;
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = localStorage.getItem('spotify_refresh_token');
  if (!refresh) return false;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  saveTokens(data);
  return true;
}

function saveTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem('spotify_access_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
  localStorage.setItem('spotify_expires_at', String(Date.now() + data.expires_in * 1000));
}

export function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token');
}

export function isTokenExpired(): boolean {
  const exp = localStorage.getItem('spotify_expires_at');
  if (!exp) return true;
  return Date.now() > parseInt(exp) - 60_000;
}

export function clearSpotifyTokens() {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_expires_at');
  localStorage.removeItem('spotify_code_verifier');
}

// --- API wrapper ---
async function spotifyFetch(path: string, options?: RequestInit): Promise<Response> {
  if (isTokenExpired()) {
    const ok = await refreshAccessToken();
    if (!ok) throw new Error('SESSION_EXPIRED');
  }
  const token = getAccessToken();
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

// --- User profile ---
export async function getSpotifyProfile(): Promise<SpotifyUser | null> {
  try {
    const res = await spotifyFetch('/me');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// --- Search ---
export async function searchSpotify(query: string): Promise<SpotifySearchResult | null> {
  if (!query.trim()) return null;
  try {
    const params = new URLSearchParams({ q: query, type: 'track,artist,album', limit: '10' });
    const res = await spotifyFetch(`/search?${params}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// --- Player ---
export async function getPlayerState(): Promise<SpotifyPlayerState | null> {
  try {
    const res = await spotifyFetch('/me/player');
    if (res.status === 204 || !res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function playTrack(uris: string[]): Promise<boolean> {
  try {
    const res = await spotifyFetch('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify({ uris }),
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function pausePlayer(): Promise<boolean> {
  try {
    const res = await spotifyFetch('/me/player/pause', { method: 'PUT' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function resumePlayer(): Promise<boolean> {
  try {
    const res = await spotifyFetch('/me/player/play', { method: 'PUT' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function skipNext(): Promise<boolean> {
  try {
    const res = await spotifyFetch('/me/player/next', { method: 'POST' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function skipPrevious(): Promise<boolean> {
  try {
    const res = await spotifyFetch('/me/player/previous', { method: 'POST' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function setVolume(volumePercent: number): Promise<boolean> {
  try {
    const res = await spotifyFetch(`/me/player/volume?volume_percent=${Math.round(volumePercent)}`, { method: 'PUT' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function setShuffle(state: boolean): Promise<boolean> {
  try {
    const res = await spotifyFetch(`/me/player/shuffle?state=${state}`, { method: 'PUT' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function setRepeat(state: 'off' | 'track' | 'context'): Promise<boolean> {
  try {
    const res = await spotifyFetch(`/me/player/repeat?state=${state}`, { method: 'PUT' });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function getTopTracks(): Promise<SpotifyTrack[]> {
  try {
    const res = await spotifyFetch('/me/top/tracks?limit=10&time_range=short_term');
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

// --- Types ---
export type SpotifyUser = {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
  product: string;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
};

export type SpotifySearchResult = {
  tracks?: { items: SpotifyTrack[] };
};

export type SpotifyPlayerState = {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  shuffle_state: boolean;
  repeat_state: 'off' | 'track' | 'context';
  device: { volume_percent: number; name: string };
};
