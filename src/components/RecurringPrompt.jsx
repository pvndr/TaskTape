export default function RecurringPrompt({ title, color, onAccept, onDismiss }) {
  if (!title) return null;

  const rawTitle = title || '';
  const truncatedTitle = rawTitle.length > 36 ? rawTitle.slice(0, 36) + '…' : rawTitle;

  return (
    <div className="my-2.5 tape-shadow-wrapper select-none">
      <div className="bg-tape-teal torn-tape p-3.5 flex flex-col gap-2.5 border border-black/10 animate-slide-settle transform rotate-0.5">
        <div className="flex items-start gap-2.5">
          <span className="text-base select-none shrink-0" role="img" aria-label="repeat">
            🔁
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-sans font-bold text-xs uppercase tracking-wider text-kraft-dark/80 bg-black/10 px-1.5 py-0.5 rounded-xs">
                3-Day Streak
              </span>
              <span className="font-hand font-bold text-base text-kraft-dark truncate">
                "{truncatedTitle}"
              </span>
            </div>
            <p className="font-sans text-xs text-kraft-dark/90 leading-relaxed mt-1 font-medium">
              You've taped this task 3 days in a row! Save it as a recurring tape in your board?
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1.5 rounded text-xs font-semibold text-kraft-dark/70 hover:text-kraft-dark hover:bg-black/5 transition-all"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-3.5 py-1.5 rounded bg-kraft-dark text-tape-cream text-xs font-bold font-sans hover:bg-kraft-dark/90 active:scale-95 transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Save to Recurring</span>
            <span className="text-[10px]">✨</span>
          </button>
        </div>
      </div>
    </div>
  );
}
