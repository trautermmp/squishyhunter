import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getReports, getProducts } from './api';
import MapView from './components/MapView';
import StoreSheet from './components/StoreSheet';
import SightingCard from './components/SightingCard';
import PostSightingModal from './components/PostSightingModal';
import AddStoreModal from './components/AddStoreModal';
import SearchBar from './components/SearchBar';
import FilterBar from './components/FilterBar';
import NotificationButton from './components/NotificationButton';
import { ToastStack } from './components/Toast';
import InstallPrompt from './components/InstallPrompt';
import useRealtime from './hooks/useRealtime';
import './index.css';

function MapIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l-5.447 2.724A1 1 0 003 9.618v10.764a1 1 0 001.447.894L9 19m0-13l6 3m-6 10l6-3m0 3l4.553-2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4M15 4L9 7" />
    </svg>
  );
}

function FeedIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

export default function App() {
  const [tab,       setTab]       = useState('map');
  const [reports,   setReports]   = useState([]);
  const [products,  setProducts]  = useState([]);
  const [communityStores, setCommunityStores] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [location,  setLocation]  = useState(() => {
    try { const s = localStorage.getItem('sh-location'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const savedLocation = useRef(location);
  const [locating,  setLocating]  = useState(false);
  const [filters,   setFilters]   = useState({ chain: null, productId: null });
  const [toasts,    setToasts]    = useState([]);

  const [selectedStore, setSelectedStore] = useState(null);
  const [postForStore,  setPostForStore]  = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showAddStore,  setShowAddStore]  = useState(false);

  const productsMap = useMemo(() =>
    Object.fromEntries(products.map(p => [p.id, p])), [products]
  );

  const fetchReports = useCallback(async (loc) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReports(loc ? { lat: loc.lat, lng: loc.lng } : {});
      setReports(data.reports || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCommunityStores = useCallback(async (loc) => {
    try {
      const params = loc ? `?lat=${loc.lat}&lng=${loc.lng}&radius=25` : '';
      const res  = await fetch(`/api/stores/submitted${params}`);
      const data = await res.json();
      setCommunityStores(data.stores || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    const loc = savedLocation.current;
    fetchReports(loc);
    fetchCommunityStores(loc);
    getProducts().then(d => setProducts(d.products || [])).catch(() => {});
  }, [fetchReports, fetchCommunityStores]);

  useRealtime({
    location,
    onNewReport: useCallback((report) => {
      setReports(prev => {
        if (prev.find(r => r.id === report.id)) return prev;
        return [report, ...prev];
      });
      const product = products.find(p => p.id === report.productId);
      setToasts(prev => [...prev, {
        id:      report.id,
        message: `${product?.name || report.productId} at ${report.storeName}`,
        emoji:   product?.emoji || '🧸',
      }]);
    }, [products]),
  });

  function requestGps() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' };
        setLocation(loc);
        localStorage.setItem('sh-location', JSON.stringify(loc));
        setLocating(false);
        fetchReports(loc);
        fetchCommunityStores(loc);
      },
      () => setLocating(false)
    );
  }

  function handleLocation(loc, label, useGps = false) {
    if (useGps) { requestGps(); return; }
    const full = { ...loc, label };
    setLocation(full);
    localStorage.setItem('sh-location', JSON.stringify(full));
    fetchReports(full);
    fetchCommunityStores(full);
  }

  function clearLocation() {
    setLocation(null);
    localStorage.removeItem('sh-location');
    fetchReports();
    fetchCommunityStores();
  }

  function openPostModal(store = null) {
    setPostForStore(store);
    setShowPostModal(true);
  }

  function handlePosted(newReport) {
    setReports(prev => [newReport, ...prev]);
  }

  function handleConfirmed(updated) {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  function handleStoreAdded(store) {
    setCommunityStores(prev => [...prev, {
      ...store,
      storeId:   `community-${store.id}`,
      source:    'community',
      community: true,
      products:  [],
      inventoryBlocked: true,
      address:   [store.address, store.city, store.state].filter(Boolean).join(', '),
    }]);
  }

  const filteredReports = useMemo(() => reports.filter(r => {
    if (filters.chain) {
      // 'other' catches both 'other' and legacy 'unknown' chain values
      const chainMatch = filters.chain === 'other'
        ? (r.chain === 'other' || r.chain === 'unknown')
        : r.chain === filters.chain;
      if (!chainMatch) return false;
    }
    if (filters.productId && r.productId !== filters.productId) return false;
    return true;
  }), [reports, filters]);

  const hasFilters = filters.chain !== null || filters.productId !== null;

  return (
    <div className="flex flex-col h-dvh bg-slate-50">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <header className="bg-zinc-900 shrink-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo-icon.svg" alt="" className="w-7 h-7 shrink-0" aria-hidden="true" />
            <span
              className="text-[22px] leading-none text-white tracking-wide"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              SQUISHY HUNTER
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationButton location={location} />
            <button
              onClick={() => openPostModal()}
              className="bg-pink-400 hover:bg-pink-300 text-zinc-900 text-sm font-bold px-4 py-2 rounded-full transition-colors"
            >
              + Post
            </button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pb-3">
          <SearchBar location={location} locating={locating} onLocation={handleLocation} onClear={clearLocation} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">

        {/* MAP TAB */}
        <div className={`absolute inset-0 ${tab === 'map' ? 'block' : 'hidden'}`}>
          <MapView
            location={location}
            reports={reports}
            communityStores={communityStores}
            onStoreSelect={setSelectedStore}
          />
          <button
            onClick={() => setShowAddStore(true)}
            className="absolute bottom-4 right-3 z-[1000] bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
          >
            + Add store
          </button>
        </div>

        {/* FEED TAB */}
        <div className={`absolute inset-0 overflow-y-auto ${tab === 'feed' ? 'block' : 'hidden'}`}>
          <div className="max-w-lg mx-auto px-4 py-4">
            {products.length > 0 && (
              <FilterBar products={products} filters={filters} onChange={setFilters} />
            )}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {location ? `Near ${location.label}` : 'Recent Sightings'}
              </h2>
              {!loading && (
                <span className="text-xs text-gray-400">
                  {filteredReports.length} {filteredReports.length === 1 ? 'sighting' : 'sightings'}
                  {hasFilters && ' (filtered)'}
                </span>
              )}
            </div>

            {loading && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl h-32 animate-pulse border border-gray-100" />
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600">
                {error} — <button onClick={() => fetchReports(location)} className="underline">retry</button>
              </div>
            )}

            {!loading && !error && filteredReports.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">🔍</div>
                {hasFilters ? (
                  <>
                    <p className="font-medium text-gray-600 text-sm">No sightings match your filters</p>
                    <button onClick={() => setFilters({ chain: null, productId: null })} className="mt-3 text-sm text-pink-600 underline">Clear filters</button>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-600 text-sm">No sightings yet</p>
                    <p className="text-xs mt-1 text-gray-400">Be the first to post one!</p>
                    <button onClick={() => openPostModal()} className="mt-4 bg-pink-400 hover:bg-pink-300 text-zinc-900 text-sm font-bold px-5 py-2.5 rounded-full transition-colors">Post a Sighting</button>
                  </>
                )}
              </div>
            )}

            {!loading && !error && filteredReports.length > 0 && (
              <div className="flex flex-col gap-3">
                {filteredReports.map(r => (
                  <SightingCard key={r.id} report={r} product={productsMap[r.productId]} onConfirmed={handleConfirmed} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="bg-zinc-900 shrink-0 z-50">
        <div className="max-w-lg mx-auto flex">
          {[
            { id: 'map',  label: 'Map',  Icon: MapIcon },
            { id: 'feed', label: 'Feed', Icon: FeedIcon },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors
                  ${active ? 'text-pink-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <t.Icon active={active} />
                <span>{t.label}</span>
                {active && <span className="w-4 h-0.5 rounded-full bg-pink-400 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Store sheet */}
      {selectedStore && (
        <StoreSheet
          store={selectedStore}
          reports={reports}
          productsMap={productsMap}
          onClose={() => setSelectedStore(null)}
          onPostSighting={store => { setSelectedStore(null); openPostModal(store); }}
        />
      )}

      {/* Modals */}
      {showPostModal && (
        <PostSightingModal
          location={location}
          preselectedStore={postForStore}
          onClose={() => { setShowPostModal(false); setPostForStore(null); }}
          onPosted={handlePosted}
        />
      )}
      {showAddStore && (
        <AddStoreModal
          onClose={() => setShowAddStore(false)}
          onAdded={handleStoreAdded}
        />
      )}

      <InstallPrompt />
    </div>
  );
}
