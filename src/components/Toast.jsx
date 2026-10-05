import { useEffect } from 'react';

export default function Toast({ message, onClose, duration = 4000, variant = 'error' }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isInfo = variant === 'info';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg shadow-lg border animate-slide-settle ${
          isInfo
            ? 'bg-tape-mustard text-kraft-dark border-black/15 shadow-md'
            : 'bg-tape-red text-kraft-dark border-red-400/50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isInfo ? (
            <svg
              className="w-4 h-4 text-kraft-dark shrink-0 stroke-current fill-none stroke-2"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-red-700 shrink-0 stroke-current fill-none stroke-2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span
            className={`text-xs font-semibold truncate font-sans ${
              isInfo ? 'text-kraft-dark' : 'text-red-950'
            }`}
          >
            {message}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`shrink-0 text-xs font-bold p-1 ${
            isInfo ? 'text-kraft-dark/60 hover:text-kraft-dark' : 'text-red-900/60 hover:text-red-950'
          }`}
          aria-label="Dismiss toast"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
