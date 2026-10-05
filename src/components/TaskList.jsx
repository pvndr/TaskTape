import TaskStrip from './TaskStrip';

/**
 * Returns a sortable day key (YYYY-MM-DD) in device local time.
 */
export function getLocalDayKey(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date into "Today", "Yesterday", weekday name for 2-6 days ago,
 * or short date like "14 Sep" (with year only if differing from current year).
 */
export function formatDayHeader(dateInput, now = new Date()) {
  if (!dateInput) return 'Earlier';
  const target = new Date(dateInput);
  if (isNaN(target.getTime())) return 'Earlier';

  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - targetMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 6) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(target);
  }

  const dayNum = target.getDate();
  const monthStr = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(target);
  if (target.getFullYear() !== now.getFullYear()) {
    return `${dayNum} ${monthStr} ${target.getFullYear()}`;
  }
  return `${dayNum} ${monthStr}`;
}

/**
 * Small, readable tape-style label in Caveat as a semantic heading.
 */
function DayHeader({ title }) {
  return (
    <div className="pt-3.5 pb-1 px-1 flex items-center">
      <h2 className="inline-flex items-center px-2.5 py-0.5 font-hand text-lg md:text-xl font-bold text-kraft-dark bg-tape-cream/95 border border-black/15 rounded-xs tape-shadow transform -rotate-0.5 select-none tracking-wide">
        {title}
      </h2>
    </div>
  );
}

export default function TaskList({
  tasks,
  filter,
  onToggle,
  onDelete,
  onClear,
  onRestore,
  loading,
  highlightedTaskId,
  now = new Date()
}) {
  const sortByNewestCreated = (a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  };

  // Active tasks exclude tasks whose deleted_at is set
  const activeTasks = tasks.filter((t) => !t.done && !t.deleted_at);
  // All view completed tasks exclude tasks whose deleted_at is set
  const allViewDoneTasks = tasks.filter((t) => t.done && !t.deleted_at);
  // Done view shows ALL completed tasks, cleared or not
  const doneTasks = tasks.filter((t) => t.done);

  // Group active tasks by created_at calendar day
  const activeDayGroupsMap = new Map();
  for (const task of activeTasks) {
    const dayKey = getLocalDayKey(task.created_at) || '0000-00-00';
    if (!activeDayGroupsMap.has(dayKey)) {
      activeDayGroupsMap.set(dayKey, {
        dayKey,
        title: formatDayHeader(task.created_at, now),
        tasks: []
      });
    }
    activeDayGroupsMap.get(dayKey).tasks.push(task);
  }

  // Sort active groups: newest day first, newest task first inside each day
  const sortedActiveGroups = Array.from(activeDayGroupsMap.values()).sort((a, b) =>
    b.dayKey.localeCompare(a.dayKey)
  );
  sortedActiveGroups.forEach((group) => group.tasks.sort(sortByNewestCreated));

  // Group done tasks for 'done' filter by completed_at calendar day
  const doneDayGroupsMap = new Map();
  const earlierTasks = [];

  for (const task of doneTasks) {
    if (!task.completed_at) {
      earlierTasks.push(task);
    } else {
      const dayKey = getLocalDayKey(task.completed_at);
      if (!dayKey) {
        earlierTasks.push(task);
      } else {
        if (!doneDayGroupsMap.has(dayKey)) {
          doneDayGroupsMap.set(dayKey, {
            dayKey,
            baseTitle: formatDayHeader(task.completed_at, now),
            tasks: []
          });
        }
        doneDayGroupsMap.get(dayKey).tasks.push(task);
      }
    }
  }

  // Sort done groups: newest completed day first, inside each group newest completed_at first
  const sortedDoneGroups = Array.from(doneDayGroupsMap.values()).sort((a, b) =>
    b.dayKey.localeCompare(a.dayKey)
  );
  sortedDoneGroups.forEach((group) => {
    group.tasks.sort((a, b) => {
      const timeA = new Date(a.completed_at || 0).getTime();
      const timeB = new Date(b.completed_at || 0).getTime();
      return timeB - timeA;
    });
    group.title = `${group.baseTitle} · ${group.tasks.length} done`;
  });

  // Earlier tasks with no completed_at sorted by newest created_at first at the end
  if (earlierTasks.length > 0) {
    earlierTasks.sort(sortByNewestCreated);
    sortedDoneGroups.push({
      dayKey: 'earlier',
      title: `Earlier · ${earlierTasks.length} done`,
      tasks: earlierTasks
    });
  }

  if (loading) {
    return (
      <div className="py-16 px-4 text-center select-none">
        <div className="inline-block p-6 bg-kraft-card/70 rounded-xl border border-kraft-border/60 max-w-xs shadow-xs space-y-3">
          <div className="w-32 h-6 mx-auto bg-tape-mustard torn-tape tape-shadow animate-pulse transform -rotate-1 flex items-center justify-center">
            <span className="font-hand text-base font-bold text-kraft-dark/70">Unrolling...</span>
          </div>
          <p className="font-sans text-xs text-kraft-dark/70 font-semibold">
            Fetching your taped tasks...
          </p>
        </div>
      </div>
    );
  }

  const hasNoTasks =
    (filter === 'active' && activeTasks.length === 0) ||
    (filter === 'done' && doneTasks.length === 0) ||
    (filter === 'all' && activeTasks.length === 0 && allViewDoneTasks.length === 0);

  if (hasNoTasks) {
    return (
      <div className="py-16 px-4 text-center select-none">
        <div className="inline-block p-6 bg-kraft-card/50 rounded-xl border-2 border-dashed border-kraft-border/60 max-w-xs shadow-xs">
          <p className="font-hand text-2xl text-kraft-dark/75">
            {filter === 'done'
              ? 'No completed tasks yet.'
              : filter === 'active'
              ? 'All clear! No active tasks.'
              : 'No strips taped yet. Write one below to stick it to your board!'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">
      {/* 1. Active View: active tasks grouped under day headers */}
      {filter === 'active' &&
        sortedActiveGroups.map((group) => (
          <section key={group.dayKey} aria-label={group.title}>
            <DayHeader title={group.title} />
            <div className="space-y-1">
              {group.tasks.map((task) => (
                <TaskStrip
                  key={task.id}
                  task={task}
                  view="active"
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onClear={onClear}
                  onRestore={onRestore}
                  isHighlighted={highlightedTaskId === task.id}
                />
              ))}
            </div>
          </section>
        ))}

      {/* 2. Done View: completed tasks grouped by completed_at day with counts */}
      {filter === 'done' &&
        sortedDoneGroups.map((group) => (
          <section key={group.dayKey} aria-label={group.title}>
            <DayHeader title={group.title} />
            <div className="space-y-1">
              {group.tasks.map((task) => (
                <TaskStrip
                  key={task.id}
                  task={task}
                  view="done"
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onClear={onClear}
                  onRestore={onRestore}
                  isHighlighted={highlightedTaskId === task.id}
                />
              ))}
            </div>
          </section>
        ))}

      {/* 3. All View: active tasks grouped under day headers, then completed tasks at bottom without day headers */}
      {filter === 'all' && (
        <>
          {sortedActiveGroups.map((group) => (
            <section key={group.dayKey} aria-label={group.title}>
              <DayHeader title={group.title} />
              <div className="space-y-1">
                {group.tasks.map((task) => (
                  <TaskStrip
                    key={task.id}
                    task={task}
                    view="all"
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onClear={onClear}
                    onRestore={onRestore}
                    isHighlighted={highlightedTaskId === task.id}
                  />
                ))}
              </div>
            </section>
          ))}

          {allViewDoneTasks.length > 0 && (
            <div className="space-y-1 pt-2">
              {allViewDoneTasks.sort(sortByNewestCreated).map((task) => (
                <TaskStrip
                  key={task.id}
                  task={task}
                  view="all"
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onClear={onClear}
                  onRestore={onRestore}
                  isHighlighted={highlightedTaskId === task.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
