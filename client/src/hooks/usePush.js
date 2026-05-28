import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const API_BASE = import.meta.env.VITE_API_URL || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function usePush({ location }) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(false);

  // Check on mount if already subscribed
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setSubscribed(true);
      })
    );
  }, []);

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
        }),
      });

      setSubscribed(true);
    } catch (err) {
      console.error('[push] subscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_BASE}/api/push/subscribe`, {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('[push] unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }

  const supported = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
