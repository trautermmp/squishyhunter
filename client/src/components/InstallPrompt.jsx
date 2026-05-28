import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [prompt,     setPrompt]     = useState(null);   // deferred install event
  const [showIos,    setShowIos]    = useState(false);  // iOS manual instructions
  const [dismissed,  setDismissed]  = useState(false);

  useEffect(() => {
    // Already installed — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('pwa-dismissed')) return;

    // Android / Chrome — browser fires this event when installable
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari — no install event, show manual instructions instead
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = window.navigator.standalone;
    if (isIos && !isInStandalone) setShowIos(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    setPrompt(null);
    setShowIos(false);
    localStorage.setItem('pwa-dismissed', '1');
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setPrompt(null);
  }

  if (dismissed || (!prompt && !showIos)) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-[2000] px-4 pb-2 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-pink-100 p-4 flex items-start gap-3">
        <img src="/pwa-192x192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Add Squishy Hunter to your home screen</p>
          {showIos ? (
            <p className="text-xs text-gray-500 mt-1">
              Tap <strong>Share</strong> <span className="text-base">⎋</span> then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Install the app for the full experience — works offline too
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {!showIos && (
            <button
              onClick={install}
              className="bg-pink-400 hover:bg-pink-300 text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 text-xs text-center transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
