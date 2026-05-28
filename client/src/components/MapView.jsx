import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getStores } from '../api';

// ── Chain config ──────────────────────────────────────────────────────────────

const CHAIN = {
  target:          { color: '#dc2626', label: 'T' },
  walmart:         { color: '#0253e3', label: 'W' },
  fivebelow:       { color: '#065ef0', label: 'FB' },
  learningexpress: { color: '#4eb530', label: 'LE' },
  other:           { color: '#f472b6', label: '?' },
};

const STATUS_COLOR = {
  in_stock:     '#22c55e',
  low_stock:    '#f59e0b',
  out_of_stock: '#ef4444',
};

// ── Custom pin factory ────────────────────────────────────────────────────────

function makePin(chain, status, community = false, name = '') {
  const cfg   = CHAIN[chain] || { color: '#262626', label: name.charAt(0).toUpperCase() || '?' };
  const bg    = community ? '#262626' : cfg.color;
  const label = community ? (name.charAt(0).toUpperCase() || '?') : cfg.label;
  const dot   = status
    ? `<div style="position:absolute;bottom:-3px;right:-3px;width:12px;height:12px;
         border-radius:50%;background:${STATUS_COLOR[status]};border:2px solid white;"></div>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;width:34px;height:34px;border-radius:50%;
      background:${bg};color:white;
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:11px;font-family:system-ui,sans-serif;
    ">${label}${dot}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -22],
  });
}

// ── Recenter helper ───────────────────────────────────────────────────────────

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// ── Sighting status for a store ───────────────────────────────────────────────

function storeStatus(storeId, reports) {
  const mine = reports
    .filter(r => r.storeId === storeId)
    .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  return mine[0]?.status ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapView({ location, radius = 25, reports, communityStores, onStoreSelect }) {
  const [stores,  setStores]  = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    getStores({ lat: location.lat, lng: location.lng, radius })
      .then(d => setStores(d.stores || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location, radius]);

  const allStores = [...stores, ...(communityStores || [])];

  const center = location
    ? [location.lat, location.lng]
    : [39.5, -98.35]; // centre of US
  const zoom = location ? 12 : 4;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController center={center} zoom={zoom} />

        {allStores
          .filter(s => s.lat != null && s.lng != null)
          .map(store => {
            const status = storeStatus(store.storeId, reports);
            return (
              <Marker
                key={`${store.chain}-${store.storeId}`}
                position={[store.lat, store.lng]}
                icon={makePin(store.chain, status, store.community, store.name)}
                eventHandlers={{ click: () => onStoreSelect({ ...store, status }) }}
              />
            );
          })}
      </MapContainer>

      {/* No-location overlay */}
      {!location && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-[1000]">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 text-center max-w-xs mx-4">
            <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-800 text-sm mb-1">Find stores near you</p>
            <p className="text-xs text-gray-500 leading-relaxed">Enter a ZIP code or share your GPS location to see store pins on the map.</p>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-full px-4 py-1.5 shadow-sm border border-gray-100 text-xs font-medium text-gray-500">
          Loading stores…
        </div>
      )}

      {/* Legend */}
      {location && (
        <div className="absolute bottom-4 left-3 z-[1000] bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2.5 flex flex-col gap-1.5 text-xs text-gray-600">
          <span className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">Status</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>In stock</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Low stock</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Out of stock</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300"></span>No reports</span>
        </div>
      )}
    </div>
  );
}
