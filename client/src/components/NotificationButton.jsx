import usePush from '../hooks/usePush';

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 01-3.46 0M18.63 13A17.888 17.888 0 0118 11a6 6 0 00-9.33-4.997M6.26 6.26A5.86 5.86 0 006 8c0 4-1.55 5.58-2.39 6.56A1 1 0 004.4 16h15.2a1 1 0 00.78-1.63A13.47 13.47 0 0119 11M3 3l18 18" />
    </svg>
  );
}

export default function NotificationButton({ location }) {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePush({ location });

  if (!supported || permission === 'denied') return null;

  if (subscribed) {
    return (
      <button
        onClick={unsubscribe}
        disabled={loading}
        title="Turn off notifications"
        className="text-pink-400 hover:text-pink-200 transition-colors disabled:opacity-40 p-1"
      >
        <BellIcon />
      </button>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={loading}
      title="Get notified of new sightings near you"
      className="text-zinc-500 hover:text-pink-400 transition-colors disabled:opacity-40 p-1"
    >
      <BellOffIcon />
    </button>
  );
}
