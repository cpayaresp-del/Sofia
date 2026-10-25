import { useState, type FormEvent } from 'react';
import { ExternalLink, Loader2, Search, Globe2 } from 'lucide-react';
import { api, type WebSearchResult } from '@/lib/api';

export default function WebPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WebSearchResult[]>([]);
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
    try {
      const response = await api.web.search(term);
      setResults(response.results);
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : 'No se pudo completar la búsqueda.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Búsqueda web</h2>
        <p className="text-sm text-gray-500 mt-0.5">Busca información en Internet con DuckDuckGo, sin una clave de API.</p>
      </div>

      <form onSubmit={search} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={300}
            placeholder="¿Qué quieres buscar?"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </form>

      {error && <p role="alert" className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">{error}</p>}

      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Resultados de búsqueda</h3>
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : results.length ? (
          <div className="divide-y divide-gray-100">
            {results.map((result) => (
              <article key={result.url} className="py-4 first:pt-0 last:pb-0">
                <a href={result.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 text-blue-700 font-medium hover:underline">
                  {result.title}
                  <ExternalLink size={13} className="text-gray-400 group-hover:text-blue-600" />
                </a>
                <p className="text-xs text-emerald-700 truncate mt-1">{result.url}</p>
                {result.snippet && <p className="text-sm text-gray-600 mt-2">{result.snippet}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-400">
            <Globe2 size={28} className="mx-auto mb-2 text-gray-300" />
            {searched ? 'No encontramos resultados.' : 'Escribe una búsqueda para explorar la web.'}
          </div>
        )}
      </section>
    </div>
  );
}
