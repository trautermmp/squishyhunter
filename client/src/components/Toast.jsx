import { useEffect, useState } from 'react';

export function Toast({ message, emoji = '🧸', onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 6000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 bg-white border border-gray-100 rounded-xl shadow-md px-4 py-3 max-w-sm transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <span className="text-lg shrink-0 mt-0.5">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Sighting</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{message}</p>
      </div>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="text-gray-300 hover:text-gray-500 shrink-0 text-base leading-none mt-0.5 transition-colors"
      >
        ×
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 items-center w-full px-4 max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto w-full">
          <Toast message={t.message} emoji={t.emoji} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
