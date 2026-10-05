export default function FilterChips({ currentFilter, onFilterChange, activeCount, totalCount, loading }) {
  const doneCount = totalCount - activeCount;

  return (
    <div className="flex items-center justify-between gap-2 px-1 py-2 font-sans select-none">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 bg-black/10 p-1 rounded-lg border border-black/5 backdrop-blur-xs">
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            currentFilter === 'all'
              ? 'bg-tape-cream text-kraft-dark shadow-xs'
              : 'text-kraft-dark/70 hover:text-kraft-dark'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('active')}
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            currentFilter === 'active'
              ? 'bg-tape-cream text-kraft-dark shadow-xs'
              : 'text-kraft-dark/70 hover:text-kraft-dark'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('done')}
          className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
            currentFilter === 'done'
              ? 'bg-tape-cream text-kraft-dark shadow-xs'
              : 'text-kraft-dark/70 hover:text-kraft-dark'
          }`}
        >
          Done
        </button>
      </div>

      {/* Progress stamp */}
      <div className="flex items-center gap-1 text-xs font-semibold text-kraft-dark/80 bg-black/5 px-2.5 py-1 rounded-md border border-black/10 min-w-[85px] justify-center">
        {loading ? (
          <span className="italic text-kraft-dark/60">Loading...</span>
        ) : (
          <>
            <span className="font-bold text-kraft-dark">{doneCount}</span> of <span>{totalCount}</span> done
          </>
        )}
      </div>
    </div>
  );
}
