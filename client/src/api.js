const BASE = import.meta.env.VITE_API_URL || '';

export async function getReports({ lat, lng, radius = 25 } = {}) {
  const params = new URLSearchParams();
  if (lat != null) params.set('lat', lat);
  if (lng != null) params.set('lng', lng);
  params.set('radius', radius);
  const res = await fetch(`${BASE}/api/reports?${params}`);
  if (!res.ok) throw new Error('Failed to load sightings');
  return res.json();
}

export async function getStores({ lat, lng, radius = 25 }) {
  const params = new URLSearchParams({ lat, lng, radius });
  const res = await fetch(`${BASE}/api/stores?${params}`);
  if (!res.ok) throw new Error('Failed to load stores');
  return res.json();
}

export async function getProducts() {
  const res = await fetch(`${BASE}/api/products`);
  if (!res.ok) throw new Error('Failed to load products');
  return res.json();
}

export async function postReport(body) {
  const res = await fetch(`${BASE}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit sighting');
  return data;
}

export async function confirmReport(id) {
  const res = await fetch(`${BASE}/api/reports/${id}/confirm`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to confirm');
  return data;
}

export async function getProductSuggestions() {
  const res = await fetch(`${BASE}/api/products/suggestions`);
  if (!res.ok) return { suggestions: [] };
  return res.json();
}

export async function getSubmittedStores({ lat, lng, radius = 25 } = {}) {
  const params = lat != null ? `?lat=${lat}&lng=${lng}&radius=${radius}` : '';
  const res = await fetch(`${BASE}/api/stores/submitted${params}`);
  if (!res.ok) return { stores: [] };
  return res.json();
}

export async function submitStore(data) {
  return fetch(`${BASE}/api/stores/submit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

export async function uploadSightingImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE}/api/reports/image`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.imageUrl;
}

export async function searchPlaces(query, location = null) {
  const coords = location ? `&lat=${location.lat}&lng=${location.lng}` : '';
  const res = await fetch(`${BASE}/api/places/autocomplete?q=${encodeURIComponent(query)}${coords}`);
  if (!res.ok) return { suggestions: [] };
  return res.json();
}

export async function getPlaceDetails(placeId) {
  const res = await fetch(`${BASE}/api/places/details?placeId=${encodeURIComponent(placeId)}`);
  if (!res.ok) throw new Error('Failed to get place details');
  return res.json();
}

export async function geocodeZip(zip) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'SquishyHunter/1.0' } });
  if (!res.ok) throw new Error('Geocoding service unavailable');
  const data = await res.json();
  if (!data.length) throw new Error('ZIP code not found');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}
