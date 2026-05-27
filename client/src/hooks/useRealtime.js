import { useEffect, useCallback } from 'react';
import supabase from '../supabase';

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Converts a snake_case DB row to the camelCase shape the app uses
function rowToReport(row) {
  return {
    id:          row.id,
    storeId:     row.store_id,
    storeName:   row.store_name,
    chain:       row.chain,
    lat:         row.lat,
    lng:         row.lng,
    productId:         row.product_id,
    customProductName: row.custom_product_name ?? null,
    qty:               row.qty,
    status:      row.status,
    note:        row.note,
    reportedAt:  row.reported_at,
    expiresAt:   row.expires_at,
    confirmedBy: row.confirmed_by,
  };
}

export default function useRealtime({ location, radiusMiles = 25, onNewReport }) {
  const handleInsert = useCallback((payload) => {
    const report = rowToReport(payload.new);

    // Skip if it's expired already (shouldn't happen but guard anyway)
    if (new Date(report.expiresAt) < new Date()) return;

    // If user has a location, only notify for nearby reports
    if (location && report.lat != null && report.lng != null) {
      const dist = haversineMiles(location.lat, location.lng, report.lat, report.lng);
      if (dist > radiusMiles) return;
    }

    onNewReport(report);
  }, [location, radiusMiles, onNewReport]);

  useEffect(() => {
    const channel = supabase
      .channel('reports-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, handleInsert)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [handleInsert]);
}
