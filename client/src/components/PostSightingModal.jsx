import { useState, useEffect } from 'react';
import { getStores, getProducts, getProductSuggestions, postReport } from '../api';

const CHAIN_LABEL = {
  target:          'Target',
  walmart:         'Walmart',
  fivebelow:       'Five Below',
  learningexpress: 'Learning Express',
};

const CHAIN_OPTIONS = [
  { id: 'target',          label: 'Target' },
  { id: 'walmart',         label: 'Walmart' },
  { id: 'fivebelow',       label: 'Five Below' },
  { id: 'learningexpress', label: 'Learning Express' },
  { id: 'other',           label: 'Other / Independent' },
];

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 bg-white';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

export default function PostSightingModal({ location, preselectedStore, onClose, onPosted }) {
  const [stores,      setStores]      = useState([]);
  const [products,    setProducts]    = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(!preselectedStore);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  const [form, setForm] = useState({
    storeIndex:        '',
    productId:         '',
    customProductName: '',
    otherChain:        'other',
    status:            'in_stock',
    qty:               '',
    note:              '',
    otherStoreName:    '',
    otherStoreChain:   'other',
  });

  const isOtherStore   = form.storeIndex === 'other';
  const isCustomProduct = form.productId === 'custom';

  useEffect(() => {
    if (preselectedStore) {
      Promise.all([getProducts(), getProductSuggestions()])
        .then(([pd, sd]) => {
          setProducts(pd.products || []);
          setSuggestions(sd.suggestions || []);
        })
        .catch(() => {});
      return;
    }
    async function load() {
      try {
        const [storesData, productsData, suggestionsData] = await Promise.all([
          location ? getStores(location) : Promise.resolve({ stores: [] }),
          getProducts(),
          getProductSuggestions(),
        ]);
        setStores(storesData.stores || []);
        setProducts(productsData.products || []);
        setSuggestions(suggestionsData.suggestions || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [location, preselectedStore]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.productId) return setError('Select a product');
    if (isCustomProduct && !form.customProductName.trim()) return setError('Enter the product name');
    if (isOtherStore && !form.otherStoreName.trim()) return setError('Enter the store name');

    const isOutOfStock = form.status === 'out_of_stock';
    const qty = isOutOfStock ? 0 : parseInt(form.qty, 10);
    if (!isOutOfStock && (isNaN(qty) || qty < 0)) return setError('Enter a valid quantity (0 or more)');

    // Resolve store fields
    let storeFields;
    if (preselectedStore) {
      storeFields = {
        storeId:   preselectedStore.storeId,
        storeName: preselectedStore.name,
        chain:     preselectedStore.chain,
        lat:       preselectedStore.lat,
        lng:       preselectedStore.lng,
      };
    } else if (isOtherStore) {
      const name = form.otherStoreName.trim();
      storeFields = {
        storeId:   `other-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        storeName: name,
        chain:     form.otherStoreChain,
        lat:       location?.lat ?? null,
        lng:       location?.lng ?? null,
      };
    } else {
      const store = stores[parseInt(form.storeIndex, 10)];
      storeFields = store
        ? { storeId: store.storeId, storeName: store.name, chain: store.chain, lat: store.lat, lng: store.lng }
        : { storeId: 'unknown', storeName: 'Unknown store' };
    }

    const body = {
      productId:         form.productId,
      status:            form.status,
      customProductName: isCustomProduct ? form.customProductName.trim() : undefined,
      qty,
      note: form.note.trim() || undefined,
      ...storeFields,
    };

    setSubmitting(true);
    try {
      const data = await postReport(body);

      // Auto-submit unlisted store for future map inclusion
      if (isOtherStore && form.otherStoreName.trim()) {
        fetch('/api/stores/submit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:  form.otherStoreName.trim(),
            chain: form.otherStoreChain,
            lat:   location?.lat ?? null,
            lng:   location?.lng ?? null,
          }),
        }).catch(() => {});
      }

      onPosted?.(data.report);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const chainLabel = preselectedStore
    ? (CHAIN_LABEL[preselectedStore.chain] || preselectedStore.chain)
    : null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Post a Sighting</h2>
            <p className="text-xs text-gray-400 mt-0.5">Help others find squishies near you</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition-colors"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 overflow-y-auto">

            {/* ── Store ── */}
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Store</label>
                {preselectedStore ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm flex items-center justify-between">
                    <span className="font-medium text-gray-800">{preselectedStore.name}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">{chainLabel}</span>
                  </div>
                ) : stores.length > 0 ? (
                  <select
                    className={inputCls}
                    value={form.storeIndex}
                    onChange={e => set('storeIndex', e.target.value)}
                  >
                    <option value="">Select a nearby store…</option>
                    {stores.map((s, i) => (
                      <option key={s.storeId} value={i}>
                        {s.name} ({s.distance} mi)
                      </option>
                    ))}
                    <option value="other">Other store not listed…</option>
                  </select>
                ) : null}
              </div>

              {/* Other store fields */}
              {!preselectedStore && (isOtherStore || stores.length === 0) && (
                <div className="flex flex-col gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {stores.length === 0 && (
                    <p className="text-xs text-gray-500">
                      {location ? 'No stores found nearby — enter the store details below.' : 'Share your location to find nearby stores, or enter the store manually.'}
                    </p>
                  )}
                  <div>
                    <label className={labelCls}>Store Name *</label>
                    <input
                      type="text" maxLength={100} placeholder="e.g. Kidville Toys"
                      className={inputCls}
                      value={form.otherStoreName}
                      onChange={e => set('otherStoreName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Store Type</label>
                    <select className={inputCls} value={form.otherStoreChain} onChange={e => set('otherStoreChain', e.target.value)}>
                      {CHAIN_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* ── Product ── */}
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Product *</label>
                <select
                  required
                  className={inputCls}
                  value={form.productId}
                  onChange={e => set('productId', e.target.value)}
                >
                  <option value="">Select a product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                  ))}
                  <option value="custom">Other / not listed…</option>
                </select>
              </div>

              {/* Custom product fields */}
              {isCustomProduct && (
                <div className="flex flex-col gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div>
                    <label className={labelCls}>Product Name *</label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="e.g. Squishmallow 16in Cow"
                      className={inputCls}
                      value={form.customProductName}
                      onChange={e => set('customProductName', e.target.value)}
                    />
                  </div>

                  {/* Previously-used suggestions */}
                  {suggestions.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Previously reported:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map(s => (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => set('customProductName', s.name)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                              ${form.customProductName === s.name
                                ? 'bg-pink-400 text-zinc-900 border-pink-400'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                          >
                            {s.name}
                            {s.count > 1 && <span className="ml-1 opacity-60">×{s.count}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Status ── */}
            <div>
              <label className={labelCls}>Stock Status *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'in_stock',     label: 'In Stock',     active: 'bg-emerald-500 text-white border-emerald-500' },
                  { id: 'low_stock',    label: 'Low Stock',    active: 'bg-amber-400 text-white border-amber-400' },
                  { id: 'out_of_stock', label: 'Out of Stock', active: 'bg-rose-500 text-white border-rose-500' },
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      set('status', s.id);
                      if (s.id === 'out_of_stock') set('qty', '0');
                    }}
                    className={`text-xs font-semibold py-2.5 rounded-xl border transition-colors
                      ${form.status === s.id
                        ? s.active
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Qty (hidden when out of stock) ── */}
            {form.status !== 'out_of_stock' && (
            <div>
              <label className={labelCls}>How many did you see?</label>
              <input
                type="number" min="1" max="999" placeholder="e.g. 6"
                className={inputCls}
                value={form.qty}
                onChange={e => set('qty', e.target.value)}
              />
            </div>
            )}

            {/* ── Note ── */}
            <div>
              <label className={labelCls}>Note (optional)</label>
              <input
                type="text" maxLength={280} placeholder="e.g. Front of toy aisle, near checkout"
                className={inputCls}
                value={form.note}
                onChange={e => set('note', e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-pink-400 hover:bg-pink-300 disabled:opacity-50 text-zinc-900 font-bold rounded-xl py-3 transition-colors"
            >
              {submitting ? 'Posting…' : 'Post Sighting'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
