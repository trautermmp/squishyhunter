import { useState, useEffect } from 'react';
import { confirmReport } from '../api';

function useCountdown(expiresAt) {
  const [label, setLabel] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    function tick() {
      const ms = new Date(expiresAt) - Date.now();
      if (ms <= 0) { setLabel('Expired'); setUrgent(true); return; }
      const hrs  = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      setUrgent(hrs < 1);
      setLabel(hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { label, urgent };
}

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

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SightingCard({ report, product, onConfirmed }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed,  setConfirmed]  = useState(false);
  const { label: countdown, urgent } = useCountdown(report.expiresAt);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const data = await confirmReport(report.id);
      setConfirmed(true);
      onConfirmed?.(data.report);
    } catch {
      // button greys out silently
    } finally {
      setConfirming(false);
    }
  }

  const statusInfo = STATUS_DOT[report.status];
  const isCustom = report.productId === 'custom';
  const emoji = product?.emoji || '✨';
  const productName = isCustom
    ? (report.customProductName || 'Custom product')
    : (product?.name || report.productId.replace(/-/g, ' '));
  const chainLabel = CHAIN_LABEL[report.chain] || report.chain;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-semibold text-gray-900 text-sm leading-snug truncate">{report.storeName}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{chainLabel}</span>
            {statusInfo && (
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dot}`} />
                {statusInfo.text}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">{timeAgo(report.reportedAt)}</span>
      </div>

      {/* Product row */}
      <div className="flex items-center gap-3">
        {product?.image ? (
          <img
            src={product.image}
            alt={productName}
            className="w-11 h-11 object-contain rounded-lg bg-gray-50"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className={`w-11 h-11 rounded-lg bg-slate-50 items-center justify-center text-xl ${product?.image ? 'hidden' : 'flex'}`}
          aria-hidden="true"
        >
          {emoji}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{productName}</p>
          {report.qty > 0 && (
            <p className="text-xs text-gray-400">{report.qty} seen · ${product?.msrp?.toFixed(2) ?? '—'}</p>
          )}
        </div>
      </div>

      {/* Photo */}
      {report.imageUrl && (
        <img
          src={report.imageUrl}
          alt="Sighting photo"
          className="w-full max-h-52 object-cover rounded-lg border border-gray-100"
        />
      )}

      {/* Note */}
      {report.note && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 italic leading-relaxed">
          "{report.note}"
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400">
            {report.confirmedBy > 0 ? `Confirmed ${report.confirmedBy}×` : 'Unconfirmed'}
          </span>
          <span className={`text-xs ${urgent ? 'text-rose-500 font-medium' : 'text-gray-400'}`}>
            {countdown}
          </span>
        </div>
        <button
          onClick={handleConfirm}
          disabled={confirming || confirmed}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {confirmed ? 'Confirmed!' : confirming ? 'Confirming…' : 'Still there?'}
        </button>
      </div>
    </div>
  );
}
