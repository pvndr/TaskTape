export default function UndoSnackbar({ pendingAction, onUndo }) {
  if (!pendingAction) return null;

  const isSoftClear = pendingAction.type === 'clear';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-kraft-dark text-tape-cream rounded-lg shadow-xl border border-black/20 animate-slide-settle">
        <div className="flex items-center gap-2 min-w-0">
          {isSoftClear ? (
            <span className="text-xs font-sans font-medium text-tape-cream truncate">
              Cleared from your list. Still in Done history.
            </span>
          ) : (
            <>
              <span className="text-xs uppercase tracking-wider font-bold text-tape-mustard font-sans shrink-0">
                Torn Off:
              </span>
              <span className="text-sm font-hand text-lg truncate text-tape-cream">
                "{pendingAction.task.title}"
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => onUndo(pendingAction)}
          className="shrink-0 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-tape-cream text-kraft-dark rounded hover:bg-tape-mustard active:scale-95 transition-all font-sans"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
