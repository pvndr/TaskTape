import React, { useState } from 'react';
import { getRotationForId } from '../lib/tasks';
import { getLocalDayKey, normalizeTitle } from '../lib/recurring';

const COLOR_BG_MAP = {
  'tape-cream': 'bg-tape-cream',
  'tape-red': 'bg-tape-red',
  'tape-mustard': 'bg-tape-mustard',
  'tape-teal': 'bg-tape-teal',
  'tape-sage': 'bg-tape-sage'
};

export default function RecurringSection({
  recurringTasks = [],
  currentTasks = [],
  onStickToday,
  onRemoveRecurring,
  now = new Date()
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!recurringTasks || recurringTasks.length === 0) {
    return null;
  }

  const todayKey = getLocalDayKey(now);

  // Check if a recurring task is already taped today (active or done)
  const isTapedToday = (recurringTitle) => {
    const clean = normalizeTitle(recurringTitle);
    return currentTasks.some(
      (t) =>
        !t.deleted_at &&
        normalizeTitle(t.title) === clean &&
        getLocalDayKey(t.created_at) === todayKey
    );
  };

  return (
    <section className="mb-4" aria-label="Recurring Events Section">
      {/* Tape style header */}
      <div className="pt-2 pb-1.5 px-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="inline-flex items-center gap-1.5 px-2.5 py-0.5 font-hand text-lg md:text-xl font-bold text-kraft-dark bg-tape-cream/95 border border-black/15 rounded-xs tape-shadow transform -rotate-0.5 select-none tracking-wide">
            <span role="img" aria-label="recurring" className="text-sm">
              🔁
            </span>
            <span>Recurring Events</span>
            <span className="ml-1 text-xs font-sans font-bold bg-kraft-dark text-tape-cream px-1.5 py-0.2 rounded-full">
              {recurringTasks.length}
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-xs font-sans font-medium text-kraft-dark/70 hover:text-kraft-dark px-2 py-1 rounded hover:bg-black/5 transition-all flex items-center gap-1"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand recurring events' : 'Collapse recurring events'}
        >
          <span>{isCollapsed ? 'Show' : 'Hide'}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isCollapsed ? '-rotate-90' : 'rotate-0'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Recurring Tapes List */}
      {!isCollapsed && (
        <div className="space-y-2 mt-1">
          {recurringTasks.map((item) => {
            const rotation = getRotationForId(item.id);
            const colorClass = COLOR_BG_MAP[item.color] || 'bg-tape-teal';
            const taped = isTapedToday(item.title);

            return (
              <div
                key={item.id}
                style={{
                  transform: `rotate(${rotation * 0.7}deg)`,
                  transformOrigin: 'center center'
                }}
                className="tape-shadow-wrapper transition-transform duration-200 select-none my-1.5"
              >
                <div
                  className={`group relative flex items-center justify-between px-3.5 py-2 torn-tape transition-all duration-300 border-l-4 border-l-black/25 ${colorClass}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <span className="text-xs font-mono font-bold tracking-tight text-kraft-dark/60 bg-black/5 px-1 py-0.5 rounded-xs shrink-0 select-none">
                      DAILY
                    </span>
                    <span className="font-hand text-lg md:text-xl font-bold text-kraft-dark truncate">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {taped ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-sans font-bold text-kraft-dark bg-black/10 px-2 py-0.5 rounded-full select-none">
                        <span>✓</span>
                        <span>Today</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStickToday(item)}
                        className="px-2.5 py-1 text-xs font-bold font-sans rounded bg-kraft-dark text-tape-cream hover:bg-kraft-dark/90 active:scale-95 transition-all shadow-xs flex items-center gap-1"
                        title="Stick this recurring task to today's board"
                      >
                        <span>+ Stick</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveRecurring(item)}
                      className="p-1 rounded text-kraft-dark/50 hover:text-red-700 hover:bg-black/10 active:scale-90 transition-all opacity-70 group-hover:opacity-100"
                      title="Remove from recurring events"
                      aria-label={`Remove ${item.title} from recurring`}
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
