import { useState } from 'react';
import { geocodeZip } from '../api';

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14a4 4 0 110-8 4 4 0 010 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

export default function SearchBar({ location, locating, radius, onLocation, onClear, onRadiusChange }) {
  const [zip,     setZip]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleZipSubmit(e) {
    e.preventDefault();
    const trimmed = zip.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const loc = await geocodeZip(trimmed);
      onLocation(loc, `ZIP ${trimmed}`);
      setZip('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (location) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-pink-400 text-xs font-medium px-3 py-1.5 rounded-full flex-1 min-w-0">
          <span className="w-1.5 h-1.5 bg-pink-400 rounded-full shrink-0" />
          <span className="truncate">{location.label}</span>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700 shrink-0">
          {[10, 25, 50].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => onRadiusChange(r)}
              className={`text-xs font-medium px-2.5 py-1.5 transition-colors
                ${radius === r ? 'bg-pink-400 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
            >
              {r}mi
            </button>
          ))}
        </div>
        <button onClick={onClear} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors shrink-0">
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start">
      <form onSubmit={handleZipSubmit} className="flex gap-2 flex-1">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder="Search by ZIP code…"
            value={zip}
            onChange={e => { setZip(e.target.value); setError(null); }}
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/40 focus:border-pink-500"
          />
          {error && <p className="text-xs text-red-400 mt-1 px-1">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={loading || zip.trim().length !== 5}
          className="shrink-0 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40"
        >
          {loading ? '…' : 'Go'}
        </button>
      </form>

      <button
        onClick={() => onLocation(null, null, true)}
        disabled={locating}
        title="Use GPS location"
        className="shrink-0 bg-pink-400 hover:bg-pink-300 text-zinc-900 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-bold"
      >
        <GpsIcon />
        {locating ? '…' : 'GPS'}
      </button>
    </div>
  );
}
