import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Music, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, Search, Loader2, AlertCircle, LogOut, User, Monitor,
} from 'lucide-react';
import {
  startSpotifyLogin,
  handleSpotifyCallback,
  getSpotifyProfile,
  searchSpotify,
  getPlayerState,
  playTrack,
  pausePlayer,
  resumePlayer,
  skipNext,
  skipPrevious,
  setVolume,
  setShuffle,
  setRepeat,
  getTopTracks,
  clearSpotifyTokens,
  getAccessToken,
  type SpotifyUser,
  type SpotifyTrack,
  type SpotifyPlayerState,
} from '@/lib/spotify';

type Props = {
  addLog: (type: 'music', desc: string) => void;
};

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TrackRow({ track, onPlay, isPlaying }: { track: SpotifyTrack; onPlay: (t: SpotifyTrack) => void; isPlaying: boolean }) {
  const cover = track.album.images[0]?.url;
  return (
    <div
      onClick={() => onPlay(track)}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors group ${
        isPlaying ? 'bg-[#1DB954]/10 border border-[#1DB954]/30' : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 relative">
        {cover && <img src={cover} alt={track.album.name} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
          <Play size={14} className="text-white ml-0.5" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-800 truncate">{track.name}</p>
        <p className="text-xs text-gray-500 truncate">{track.artists.map(a => a.name).join(', ')} · {track.album.name}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isPlaying && (
          <div className="flex gap-0.5 items-end h-4">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-0.5 bg-[#1DB954] rounded-full animate-pulse" style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        <span className="text-xs text-gray-400">{formatMs(track.duration_ms)}</span>
      </div>
    </div>
  );
}

export default function MusicPage({ addLog }: Props) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [player, setPlayer] = useState<SpotifyPlayerState | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [volume, setVolumeState] = useState(70);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'context'>('off');
  const [error, setError] = useState<string | null>(null);
  const [needsRedirect, setNeedsRedirect] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      handleSpotifyCallback(code).then((ok) => {
        if (ok) initSession();
        else { setLoading(false); setError('Error al conectar con Spotify. Inténtalo de nuevo.'); }
      });
    } else if (getAccessToken()) {
      initSession();
    } else {
      setLoading(false);
    }
  }, []);

  async function initSession() {
    setLoading(true);
    const profile = await getSpotifyProfile();
    if (!profile) {
      setConnected(false);
      setLoading(false);
      return;
    }
    setUser(profile);
    setConnected(true);
    const [state, top] = await Promise.all([getPlayerState(), getTopTracks()]);
    if (state) applyPlayerState(state);
    setTopTracks(top);
    setLoading(false);
    startPolling();
  }

  function applyPlayerState(state: SpotifyPlayerState) {
    setPlayer(state);
    setShuffleOn(state.shuffle_state);
    setRepeatMode(state.repeat_state);
    if (state.device?.volume_percent != null) setVolumeState(state.device.volume_percent);
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const state = await getPlayerState();
      if (state) applyPlayerState(state);
    }, 3000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const result = await searchSpotify(q);
      setSearchResults(result?.tracks?.items ?? []);
      setSearching(false);
    }, 400);
  }, []);

  async function handlePlay(track: SpotifyTrack) {
    const ok = await playTrack([track.uri]);
    if (ok) {
      addLog('music', `Reproduciendo: ${track.name} — ${track.artists[0]?.name}`);
      setTimeout(async () => {
        const state = await getPlayerState();
        if (state) applyPlayerState(state);
      }, 800);
    } else {
      setNeedsRedirect(true);
    }
  }

  async function togglePlay() {
    if (!player) return;
    const ok = player.is_playing ? await pausePlayer() : await resumePlayer();
    if (ok) {
      addLog('music', player.is_playing ? `Pausado: ${player.item?.name}` : `Reanudado: ${player.item?.name}`);
      setPlayer((p) => p ? { ...p, is_playing: !p.is_playing } : p);
    }
  }

  async function handleSkipNext() {
    await skipNext();
    addLog('music', 'Siguiente canción');
    setTimeout(async () => { const s = await getPlayerState(); if (s) applyPlayerState(s); }, 800);
  }

  async function handleSkipPrev() {
    await skipPrevious();
    setTimeout(async () => { const s = await getPlayerState(); if (s) applyPlayerState(s); }, 800);
  }

  async function handleVolume(v: number) {
    setVolumeState(v);
    await setVolume(v);
  }

  async function handleShuffle() {
    const next = !shuffleOn;
    await setShuffle(next);
    setShuffleOn(next);
  }

  async function handleRepeat() {
    const modes: ('off' | 'track' | 'context')[] = ['off', 'context', 'track'];
    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    await setRepeat(next);
    setRepeatMode(next);
  }

  function disconnect() {
    clearSpotifyTokens();
    if (pollRef.current) clearInterval(pollRef.current);
    setConnected(false);
    setUser(null);
    setPlayer(null);
    setTopTracks([]);
  }

  const displayTracks = query ? searchResults : topTracks;
  const currentUri = player?.item?.uri;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#1DB954]" />
          <p className="text-sm text-gray-500">Conectando con Spotify...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Música Spotify</h2>
          <p className="text-sm text-gray-500 mt-0.5">Controla la música desde el panel de Sofía</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center gap-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
            <Music size={36} className="text-[#1DB954]" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900 text-lg">Conectar con Spotify</p>
            <p className="text-sm text-gray-500 mt-1">
              Autoriza a Sofía para buscar y controlar tu música directamente.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 w-full">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={startSpotifyLogin}
            className="flex items-center gap-2 bg-[#1DB954] text-white font-semibold px-8 py-3 rounded-full hover:bg-[#1aa34a] transition-colors w-full justify-center"
          >
            <Music size={16} />
            Iniciar sesión con Spotify
          </button>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 w-full">
            <p className="font-semibold mb-1">Antes de conectar:</p>
            <p>En tu panel de desarrolladores de Spotify, añade <strong>{window.location.origin}/</strong> como Redirect URI en tu aplicación.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Música Spotify</h2>
          <p className="text-sm text-gray-500 mt-0.5">Controla la reproducción desde aquí</p>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
              {user.images[0]?.url
                ? <img src={user.images[0].url} className="w-5 h-5 rounded-full object-cover" alt="" />
                : <User size={14} className="text-gray-500" />
              }
              <span className="text-xs font-medium text-gray-700">{user.display_name}</span>
              {user.product === 'premium' && (
                <span className="text-[10px] bg-[#1DB954]/15 text-[#1DB954] font-semibold px-1.5 py-0.5 rounded-full">Premium</span>
              )}
            </div>
          )}
          <button onClick={disconnect} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors border border-gray-200 px-3 py-1.5 rounded-lg">
            <LogOut size={12} />
            Desconectar
          </button>
        </div>
      </div>

      {needsRedirect && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
          <Monitor size={14} className="flex-shrink-0 mt-0.5" />
          <p>Para controlar la reproducción, abre Spotify en tu dispositivo primero (PC, móvil o altavoz) y luego intenta de nuevo.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Player */}
        <div className="xl:col-span-1">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl p-5 text-white sticky top-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4">
              {player?.is_playing ? 'Reproduciendo ahora' : player?.item ? 'En pausa' : 'Sin reproducción activa'}
            </p>

            {player?.item ? (
              <>
                <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-gray-700 shadow-xl">
                  <img
                    src={player.item.album.images[0]?.url}
                    alt={player.item.album.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-bold text-lg truncate">{player.item.name}</p>
                <p className="text-gray-400 text-sm truncate mt-0.5">{player.item.artists.map(a => a.name).join(', ')}</p>
                <p className="text-gray-500 text-xs truncate">{player.item.album.name}</p>

                {/* Progress */}
                <div className="mt-4">
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1DB954] rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, (player.progress_ms / player.item.duration_ms) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>{formatMs(player.progress_ms)}</span>
                    <span>{formatMs(player.item.duration_ms)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="aspect-square rounded-xl bg-gray-700 mb-4 flex flex-col items-center justify-center gap-3">
                <Music size={40} className="text-gray-500" />
                <p className="text-xs text-gray-500 text-center px-4">
                  Abre Spotify en tu dispositivo y reproduce algo para controlarlo aquí
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 mt-5">
              <button
                onClick={handleShuffle}
                className={`transition-colors ${shuffleOn ? 'text-[#1DB954]' : 'text-gray-500 hover:text-white'}`}
              >
                <Shuffle size={16} />
              </button>
              <button onClick={handleSkipPrev} className="text-gray-300 hover:text-white transition-colors">
                <SkipBack size={22} />
              </button>
              <button
                onClick={togglePlay}
                disabled={!player?.item}
                className="w-12 h-12 rounded-full bg-white text-gray-900 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40"
              >
                {player?.is_playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button onClick={handleSkipNext} className="text-gray-300 hover:text-white transition-colors">
                <SkipForward size={22} />
              </button>
              <button
                onClick={handleRepeat}
                className={`transition-colors ${repeatMode !== 'off' ? 'text-[#1DB954]' : 'text-gray-500 hover:text-white'}`}
              >
                <Repeat size={16} />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 mt-5">
              <Volume2 size={14} className="text-gray-500 flex-shrink-0" />
              <input
                type="range" min={0} max={100} value={volume}
                onChange={(e) => handleVolume(parseInt(e.target.value))}
                className="flex-1 accent-[#1DB954] h-1"
              />
              <span className="text-xs text-gray-500 w-6 text-right">{volume}</span>
            </div>

            {player?.device && (
              <p className="text-[10px] text-gray-600 text-center mt-3 truncate">
                <Monitor size={10} className="inline mr-1" />
                {player.device.name}
              </p>
            )}
          </div>
        </div>

        {/* Search + tracks */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              {searching && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar canciones, artistas, álbumes..."
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
              />
            </div>

            {!query && topTracks.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tus canciones favoritas</p>
            )}
            {query && searchResults.length === 0 && !searching && (
              <p className="text-sm text-gray-400 text-center py-6">Sin resultados para "{query}"</p>
            )}

            <div className="space-y-1">
              {displayTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onPlay={handlePlay}
                  isPlaying={currentUri === track.uri && (player?.is_playing ?? false)}
                />
              ))}
            </div>

            {!query && topTracks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                Busca una canción para empezar a escuchar
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
