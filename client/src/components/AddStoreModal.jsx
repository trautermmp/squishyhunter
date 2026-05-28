import { useState } from 'react';
import { geocodeZip } from '../api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CHAINS = [
  { id: 'target',          label: 'Target' },
  { id: 'walmart',         label: 'Walmart' },
  { id: 'fivebelow',       label: 'Five Below' },
  { id: 'learningexpress', label: 'Learning Express' },
  { id: 'other',           label: 'Other / Independent' },
];

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 bg-white';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

export default function AddStoreModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', chain: 'other', address: '', city: '', state: '', zip: '', website: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Store name is required');
    if (!form.zip.trim() && !form.address.trim()) return setError('Address or ZIP code is required');

    setSubmitting(true);
    try {
      let lat = null, lng = null;
      if (form.zip.trim()) {
        try {
          const loc = await geocodeZip(form.zip.trim());
          lat = loc.lat; lng = loc.lng;
        } catch { /* geocode failed — still submit without coords */ }
      }

      const res = await fetch(`${API_BASE}/api/stores/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name.trim(),
          chain:   form.chain,
          address: form.address.trim() || null,
          city:    form.city.trim()    || null,
          state:   form.state.trim()  || null,
          zip:     form.zip.trim()    || null,
          website: form.website.trim() || null,
          lat, lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      onAdded?.(data.store);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add a Store</h2>
            <p className="text-xs text-gray-400 mt-0.5">Know a store that carries squishies? Add it to the map.</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div>
            <label className={labelCls}>Store Name *</label>
            <input
              type="text" required maxLength={100} placeholder="e.g. Kidville Toys"
              className={inputCls}
              value={form.name} onChange={e => set('name', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Chain / Type</label>
            <select className={inputCls} value={form.chain} onChange={e => set('chain', e.target.value)}>
              {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Street Address</label>
            <input
              type="text" maxLength={200} placeholder="123 Main St"
              className={inputCls}
              value={form.address} onChange={e => set('address', e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls}>City</label>
              <input type="text" maxLength={100} placeholder="City"
                className={inputCls}
                value={form.city} onChange={e => set('city', e.target.value)}
              />
            </div>
            <div className="w-16">
              <label className={labelCls}>State</label>
              <input type="text" maxLength={2} placeholder="TN"
                className={inputCls}
                value={form.state} onChange={e => set('state', e.target.value.toUpperCase())}
              />
            </div>
            <div className="w-24">
              <label className={labelCls}>ZIP *</label>
              <input type="text" maxLength={5} placeholder="37167"
                className={inputCls}
                value={form.zip} onChange={e => set('zip', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Website (optional)</label>
            <input type="text" maxLength={300} placeholder="https://…"
              className={inputCls}
              value={form.website} onChange={e => set('website', e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full bg-pink-400 hover:bg-pink-300 disabled:opacity-50 text-zinc-900 font-bold rounded-xl py-3 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Add Store to Map'}
          </button>
        </form>
      </div>
    </div>
  );
}
