import { useState, type FormEvent } from 'react';
import { ExternalLink, Loader2, Music, Play, Search, Youtube } from 'lucide-react';
import { api, type WebSearchResult } from '@/lib/api';

type Props = {
  addLog: (type: 'music', desc: string) => void;
};

type VideoResult = WebSearchResult & { videoId: string };

function getVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    let id = url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : url.searchParams.get('v');
    if (!id && (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/'))) {
      id = url.pathname.split('/')[2] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export default function MusicPage({ addLog }: Props) {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [selected, setSelected] = useState<VideoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    setVideos([]);
    setSelected(null);
    try {
      const { results } = await api.web.search(`site:youtube.com/watch ${term}`);
      setVideos(results.flatMap((result) => {
        const videoId = getVideoId(result.url);
        return videoId ? [{ ...result, videoId }] : [];
      }));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'No se pudo buscar en YouTube.');
    } finally {
      setLoading(false);
    }
  }

  function play(video: VideoResult) {
    setSelected(video);
    addLog('music', `Reproduciendo en YouTube: ${video.title}`);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">YouTube</h2>
        <p className="text-sm text-gray-500 mt-0.5">Busca música y videos y reprodúcelos aquí.</p>
      </div>

      <form onSubmit={search} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={250}
            placeholder="Busca una canción, artista o video..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </form>

      {error && <p role="alert" className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <section className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Resultados</h3>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-red-500" /></div>
          ) : videos.length ? (
            <div className="space-y-2">
              {videos.map((video) => (
                <button
                  key={video.videoId}
                  onClick={() => play(video)}
                  className={`w-full flex items-start gap-3 p-3 text-left rounded-xl border transition-colors ${
                    selected?.videoId === video.videoId
                      ? 'bg-red-50 border-red-200'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                    <Play size={17} fill="currentColor" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-800">{video.title}</span>
                    {video.snippet && <span className="block text-xs text-gray-500 mt-1 line-clamp-2">{video.snippet}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">
              {searched ? 'No encontramos videos para esa búsqueda.' : 'Busca un video para empezar.'}
            </div>
          )}
        </section>

        <section className="xl:col-span-2 bg-gray-950 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Youtube size={18} className="text-red-500" />
            <h3 className="font-semibold text-sm">Reproductor</h3>
          </div>
          {selected ? (
            <>
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <iframe
                  key={selected.videoId}
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${selected.videoId}?autoplay=1`}
                  title={selected.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <p className="text-sm font-medium mt-3">{selected.title}</p>
              <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white mt-2">
                Abrir en YouTube <ExternalLink size={12} />
              </a>
            </>
          ) : (
            <div className="aspect-video rounded-xl bg-gray-900 flex flex-col items-center justify-center text-center px-5">
              <Music size={32} className="text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">Elige un resultado para reproducirlo aquí.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
