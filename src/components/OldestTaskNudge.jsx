export function getAgeInWholeDays(createdAt) {
  if (!createdAt) return 0;
  const createdDate = new Date(createdAt);
  const now = new Date();
  const createdStartOfDay = new Date(
    createdDate.getFullYear(),
    createdDate.getMonth(),
    createdDate.getDate()
  );
  const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = nowStartOfDay.getTime() - createdStartOfDay.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getSoftTimePhrase(createdAt, ageDays) {
  if (ageDays === 2) return 'for a couple of days';
  if (ageDays >= 3 && ageDays <= 6) {
    try {
      const weekday = new Date(createdAt).toLocaleDateString(undefined, { weekday: 'long' });
      return `since ${weekday}`;
    } catch {
      return 'for a few days';
    }
  }
  if (ageDays >= 7 && ageDays <= 13) return 'for about a week';
  if (ageDays >= 14) return 'for a little while';
  return 'for a few days';
}

export function getOldestActiveTask(tasks) {
  if (!tasks || tasks.length === 0) return null;
  const activeTasks = tasks.filter((t) => !t.done && !t.deleted_at);
  if (activeTasks.length === 0) return null;

  return [...activeTasks].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

export default function OldestTaskNudge({ task, ageDays, onAccept, onDismiss }) {
  if (!task) return null;

  const rawTitle = task.title || '';
  const truncatedTitle = rawTitle.length > 40 ? rawTitle.slice(0, 40) + '…' : rawTitle;
  const timePhrase = getSoftTimePhrase(task.created_at, ageDays);

  // Stable phrasing rotation index based on task and age
  const charCodeSum = (task.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const phraseIndex = (charCodeSum + ageDays) % 4;

  const phrasings = [
    `"${truncatedTitle}" has been patiently waiting on your board ${timePhrase}.`,
    `Whenever you have a moment, "${truncatedTitle}" has been taped here ${timePhrase}.`,
    `Still thinking about "${truncatedTitle}"? It has been on your tape ${timePhrase}.`,
    `Here is a gentle note: "${truncatedTitle}" has been quietly waiting ${timePhrase}.`
  ];

  const phraseText = phrasings[phraseIndex];

  return (
    <div className="my-2.5 tape-shadow-wrapper select-none">
      <div className="bg-tape-mustard torn-tape p-3.5 flex flex-col gap-2.5 border border-black/10 animate-slide-settle transform -rotate-0.5">
        <p className="font-sans text-xs text-kraft-dark leading-relaxed font-medium">
          {phraseText}
        </p>

        <div className="flex items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1.5 rounded text-xs font-semibold text-kraft-dark/70 hover:text-kraft-dark hover:bg-black/5 transition-all"
          >
            Not today
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-3.5 py-1.5 rounded bg-kraft-dark text-tape-cream text-xs font-bold font-sans hover:bg-kraft-dark/90 active:scale-95 transition-all shadow-xs"
          >
            Let's do it
          </button>
        </div>
      </div>
    </div>
  );
}
