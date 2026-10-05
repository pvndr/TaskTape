import React, { useState, useEffect } from 'react';
import { getRotationForId } from '../lib/tasks';

const COLOR_BG_MAP = {
  'tape-cream': 'bg-tape-cream',
  'tape-red': 'bg-tape-red',
  'tape-mustard': 'bg-tape-mustard',
  'tape-teal': 'bg-tape-teal',
  'tape-sage': 'bg-tape-sage'
};

export default function TaskStrip({
  task,
  onToggle,
  onDelete,
  onClear,
  onRestore,
  isHighlighted,
  view = 'all'
}) {
  const [isTearing, setIsTearing] = useState(false);
  const [isJustAdded, setIsJustAdded] = useState(Boolean(task.justAdded));
  const rotation = getRotationForId(task.id);
  const colorClass = COLOR_BG_MAP[task.color] || 'bg-tape-cream';
  const isRestored = Boolean(task.isRestored);

  const isDoneView = view === 'done';
  const isCleared = Boolean(task.deleted_at);

  // Clear justAdded after animation finishes (~360ms) to ensure clean state and remove clip-path
  useEffect(() => {
    if (task.justAdded) {
      const timer = setTimeout(() => {
        setIsJustAdded(false);
      }, 360);
      return () => clearTimeout(timer);
    }
  }, [task.justAdded]);

  const handleDelete = (e) => {
    e?.stopPropagation();
    if (isTearing) return;
    setIsTearing(true);
    setTimeout(() => {
      onDelete(task);
    }, 300);
  };

  const handleRowClick = () => {
    if (isDoneView && isCleared) {
      // Checkbox and row click disabled on cleared strip in Done view; use Restore instead
      return;
    }
    onToggle(task.id, !task.done);
  };

  return (
    <div
      id={`task-${task.id}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center'
      }}
      className={`my-3 tape-shadow-wrapper transition-transform duration-200 select-none ${
        isTearing ? 'animate-tape-tear pointer-events-none' : ''
      } ${isHighlighted ? 'animate-gentle-glow' : ''}`}
    >
      <div
        className={`group relative flex items-center justify-between px-4 py-2.5 torn-tape transition-all duration-300 ${colorClass} ${
          task.done ? 'opacity-70' : 'opacity-100'
        } ${
          isTearing
            ? ''
            : isRestored
            ? 'animate-press-restore tape-sheen'
            : isJustAdded
            ? 'animate-tape-snap'
            : 'animate-slide-settle'
        }`}
      >
        {/* Jagged paper tear rip line when removing */}
        {isTearing && (
          <div className="absolute inset-y-0 left-[62%] -translate-x-1/2 w-6 z-20 pointer-events-none animate-tear-slash flex items-center justify-center">
            {/* White frayed paper fiber fringe */}
            <svg
              className="w-4 h-full stroke-white/90 fill-none stroke-[3.5] -translate-x-0.5"
              viewBox="0 0 12 100"
              preserveAspectRatio="none"
            >
              <path
                d="M6 0 L8 15 L3 30 L9 48 L4 65 L8 82 L5 100"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {/* Dark crevice tear line */}
            <svg
              className="w-3.5 h-full stroke-kraft-dark/85 fill-none stroke-[2] absolute inset-0"
              viewBox="0 0 12 100"
              preserveAspectRatio="none"
            >
              <path
                d="M6 0 L8 15 L3 30 L9 48 L4 65 L8 82 L5 100"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Tape texture subtle grain overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-r from-black/5 via-transparent to-black/5" />

        {/* Main interactive area: checkbox + handwritten label + optional cleared tag */}
        <div
          onClick={handleRowClick}
          className={`flex items-center gap-3 flex-1 min-w-0 py-0.5 z-10 select-none ${
            isDoneView && isCleared ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          {/* Minimalist marker-style checkbox */}
          <button
            type="button"
            disabled={isDoneView && isCleared}
            aria-label={
              isDoneView && isCleared
                ? 'Cleared task. Use Restore to return to active list'
                : task.done
                ? 'Mark task as incomplete'
                : 'Mark task as complete'
            }
            title={
              isDoneView && isCleared
                ? 'Cleared task. Use Restore to uncomplete'
                : undefined
            }
            className={`shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-colors ${
              isDoneView && isCleared
                ? 'border-kraft-dark/30 bg-kraft-dark/10 text-kraft-dark/40 cursor-not-allowed'
                : task.done
                ? 'border-kraft-dark bg-kraft-dark/15 text-kraft-dark'
                : 'border-kraft-dark/50 hover:border-kraft-dark bg-white/40'
            }`}
          >
            {task.done && (
              <svg
                className="w-3.5 h-3.5 stroke-current fill-none stroke-2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Handwritten task label & cleared tag */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              onAnimationEnd={(e) => {
                if (e.animationName === 'markerWriteIn') {
                  setIsJustAdded(false);
                }
              }}
              className={`font-hand text-2xl tracking-wide leading-tight text-kraft-dark break-words transition-all duration-200 ${
                task.done ? 'marker-line text-kraft-dark/70' : ''
              } ${isJustAdded ? 'animate-marker-write' : ''}`}
            >
              {task.title}
            </span>

            {/* Small muted "cleared" tape tag in Done view */}
            {isDoneView && isCleared && (
              <span
                title="Cleared from active list"
                className="shrink-0 px-1.5 py-0.5 text-[11px] font-sans font-semibold tracking-wider uppercase rounded bg-black/10 text-kraft-dark/65 border border-black/10 select-none"
              >
                cleared
              </span>
            )}
          </div>
        </div>

        {/* Action buttons (40px+ tap targets, mobile-friendly) */}
        {isDoneView ? (
          <div className="flex items-center gap-1 shrink-0 ml-2 z-10" onClick={(e) => e.stopPropagation()}>
            {isCleared ? (
              <button
                type="button"
                onClick={() => onRestore?.(task)}
                aria-label="Restore"
                title="Restore to list"
                className="min-w-[40px] min-h-[40px] px-2.5 py-1 text-xs font-bold font-sans rounded text-kraft-dark hover:bg-black/10 active:scale-95 transition-all flex items-center justify-center underline underline-offset-2 decoration-kraft-dark/40"
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onClear?.(task)}
                aria-label="Clear from list"
                title="Clear from list"
                className="min-w-[40px] min-h-[40px] px-2.5 py-1 text-xs font-bold font-sans rounded text-kraft-dark/75 hover:text-kraft-dark hover:bg-black/10 active:scale-95 transition-all flex items-center justify-center"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleDelete}
              disabled={isTearing}
              aria-label="Delete forever"
              title="Delete forever"
              className="min-w-[40px] min-h-[40px] px-2 py-1 text-xs font-bold font-sans rounded text-kraft-dark/50 hover:text-red-700 hover:bg-black/10 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30"
            >
              Delete forever
            </button>
          </div>
        ) : (
          /* Active and All views: × button */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (task.done) {
                // Completed task in All view: soft clear
                onClear?.(task);
              } else {
                // Active task: hard delete
                handleDelete(e);
              }
            }}
            disabled={isTearing}
            title={task.done ? 'Clear from list' : 'Remove strip'}
            aria-label={task.done ? 'Clear from list' : 'Remove task strip'}
            className="shrink-0 ml-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-kraft-dark/40 hover:text-red-700 hover:bg-black/5 transition-all z-10 disabled:opacity-30"
          >
            <svg
              className="w-4 h-4 stroke-current fill-none stroke-2"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
