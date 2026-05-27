import { useEffect, useRef } from 'react';
import SightingCard from './SightingCard';

const CHAIN_LABEL = {
  target:          'Target',
  walmart:         'Walmart',
  fivebelow:       'Five Below',
  learningexpress: 'Learning Express',
};

const STATUS_DOT = {
  in_stock:     { dot: 'bg-emerald-500', text: 'In Stock' },
  low_stock:    { dot: 'bg-amber-400',   text: 'Low Stock' },
  out_of_stock: { dot: 'bg-rose-500',    text: 'Out of Stock' },
};

export default function StoreSheet({ store, reports, productsMap, onClose, onPostSighting }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chainLabel  = CHAIN_LABEL[store.chain] || store.chain;
  const statusInfo  = store.status ? STATUS_DOT[store.status] : null;

  const storeReports = reports
    .filter(r => r.storeId === store.storeId)
    .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[1100]" onClick={onClose} />

      <div
        ref={sheetRef}
        className="fixed bottom-14 left-0 right-0 z-[1200] max-w-lg mx-auto bg-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Store header */}
        <div className="px-5 pt-2 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{store.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{store.address}</p>
              {store.distance != null && (
                <p className="text-xs text-gray-500 mt-0.5">{store.distance} mi away</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm shrink-0 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{chainLabel}</span>
            {statusInfo ? (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusInfo.dot}`} />
                {statusInfo.text}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full shrink-0 bg-gray-300" />
                No reports yet
              </span>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onPostSighting(store)}
              className="flex-1 bg-pink-400 hover:bg-pink-300 text-zinc-900 text-sm font-bold rounded-xl py-2.5 transition-colors"
            >
              Post Sighting Here
            </button>
            {store.storeUrl && (
              <a
                href={store.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 border border-gray-200 text-gray-600 text-sm rounded-xl px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                Site ↗
              </a>
            )}
          </div>
        </div>

        {/* Sightings */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            {storeReports.length > 0
              ? `${storeReports.length} sighting${storeReports.length === 1 ? '' : 's'}`
              : 'No sightings yet — be the first!'}
          </p>

          {storeReports.length > 0 && (
            <div className="flex flex-col gap-3">
              {storeReports.map(r => (
                <SightingCard
                  key={r.id}
                  report={r}
                  product={productsMap[r.productId]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
