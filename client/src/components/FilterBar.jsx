const CHAINS = [
  { id: null,              label: 'All Stores' },
  { id: 'target',          label: 'Target' },
  { id: 'walmart',         label: 'Walmart' },
  { id: 'fivebelow',       label: 'Five Below' },
  { id: 'learningexpress', label: 'Learning Express' },
  { id: 'other',           label: 'Other' },
];

export default function FilterBar({ products, filters, onChange }) {
  function setChain(chain) {
    onChange({ ...filters, chain });
  }

  function setProduct(productId) {
    onChange({ ...filters, productId });
  }

  const hasFilters = filters.chain !== null || filters.productId !== null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* Chain filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CHAINS.map(c => (
          <button
            key={String(c.id)}
            onClick={() => setChain(c.id)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap
              ${filters.chain === c.id
                ? 'bg-pink-400 text-zinc-900 border-pink-400'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Product filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setProduct(null)}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap
            ${filters.productId === null
              ? 'bg-pink-400 text-zinc-900 border-pink-400'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
        >
          All Products
        </button>
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => setProduct(p.id)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap
              ${filters.productId === p.id
                ? 'bg-pink-400 text-zinc-900 border-pink-400'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
          >
            {p.emoji} {p.name.replace('Nee-Doh ', '').replace(' (assorted)', '')}
          </button>
        ))}
        <button
          onClick={() => setProduct('custom')}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap
            ${filters.productId === 'custom'
              ? 'bg-pink-400 text-zinc-900 border-pink-400'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
        >
          ✨ Other
        </button>
      </div>

      {hasFilters && (
        <button
          onClick={() => onChange({ chain: null, productId: null })}
          className="self-start text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
