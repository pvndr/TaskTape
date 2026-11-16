import { supabase, isSupabaseConfigured } from './supabase.js';

const RECURRING_CACHE_PREFIX = 'tasktape_recurring_';
const DISMISSED_RECURRING_PREFIX = 'tasktape_recurring_dismissed_';

/**
 * Returns a sortable day key (YYYY-MM-DD) for a given date in local device time.
 */
export function getLocalDayKey(dateInput = new Date()) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a day key for N days before the base date in local device time.
 */
export function getShiftedDayKey(daysAgo = 0, baseDate = new Date()) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - daysAgo);
  return getLocalDayKey(d);
}

/**
 * Normalized string comparison helper.
 * Trims outer whitespace, collapses inner whitespace runs, and lowercases.
 */
export function normalizeTitle(title) {
  return (title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Pure function: Detects all recurring tasks from a list of tasks in a single pass using a Map.
 * A task is recurring when the same title (normalized: trim, collapse inner whitespace, case-insensitive)
 * was created on 3 consecutive local calendar days.
 * Multiple entries on the same day count as one day.
 * Completed tasks and cleared tasks (deleted_at set) are included.
 *
 * @param {Array} tasks - Full list of task objects
 * @returns {Array<{ title: string, color: string, normalizedTitle: string, streakDays: number }>}
 */
export function detectRecurringTasks(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  // Pass 1: Group unique local calendar days per normalized title using a Map
  const titleMap = new Map();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;

    const norm = normalizeTitle(task.title);
    if (!norm) continue;

    const dayKey = getLocalDayKey(task.created_at);
    if (!dayKey) continue;

    let group = titleMap.get(norm);
    if (!group) {
      group = {
        title: (task.title || '').trim().replace(/\s+/g, ' '),
        color: task.color || 'tape-teal',
        days: new Set()
      };
      titleMap.set(norm, group);
    }
    // Set ensures multiple entries on the same local calendar day count as 1 day
    group.days.add(dayKey);
  }

  // Pass 2: Check each grouped title for 3 consecutive local calendar days
  const recurring = [];

  for (const [norm, group] of titleMap.entries()) {
    if (group.days.size < 3) continue;

    // Lexicographically sorted YYYY-MM-DD strings are chronological
    const sortedDays = Array.from(group.days).sort();

    let hasStreak = false;
    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let j = 0; j < sortedDays.length - 1; j++) {
      const [y1, m1, d1] = sortedDays[j].split('-').map(Number);
      const [y2, m2, d2] = sortedDays[j + 1].split('-').map(Number);

      const utcEpoch1 = Date.UTC(y1, m1 - 1, d1);
      const utcEpoch2 = Date.UTC(y2, m2 - 1, d2);
      const dayDiff = Math.round((utcEpoch2 - utcEpoch1) / 86400000);

      if (dayDiff === 1) {
        currentConsecutive++;
        if (currentConsecutive >= 3) {
          hasStreak = true;
        }
        if (currentConsecutive > maxConsecutive) {
          maxConsecutive = currentConsecutive;
        }
      } else {
        currentConsecutive = 1;
      }
    }

    if (hasStreak) {
      recurring.push({
        title: group.title,
        color: group.color,
        normalizedTitle: norm,
        streakDays: maxConsecutive
      });
    }
  }

  return recurring;
}

/**
 * Checks if a task with the given title has been entered 3 consecutive days in a row
 * (Today, Yesterday, and 2 Days Ago) and is not already saved in the recurring list.
 * Completed tasks and cleared tasks (deleted_at set) are counted.
 */
export function checkThreeDayStreak(newTitle, tasks = [], recurringList = [], baseDate = new Date()) {
  const cleanTitle = normalizeTitle(newTitle);
  if (!cleanTitle) return false;

  // Already in recurring list?
  const alreadyRecurring = recurringList.some(
    (r) => normalizeTitle(r.title) === cleanTitle
  );
  if (alreadyRecurring) return false;

  // Find all tasks with this normalized title (completed & cleared tasks still count)
  const matchingTasks = tasks.filter(
    (t) => normalizeTitle(t.title) === cleanTitle
  );

  // Collect distinct calendar days for these tasks
  const distinctDays = new Set(
    matchingTasks.map((t) => getLocalDayKey(t.created_at)).filter(Boolean)
  );

  const todayKey = getShiftedDayKey(0, baseDate);
  const yesterdayKey = getShiftedDayKey(1, baseDate);
  const twoDaysAgoKey = getShiftedDayKey(2, baseDate);

  const hasToday = distinctDays.has(todayKey);
  const hasYesterday = distinctDays.has(yesterdayKey);
  const hasTwoDaysAgo = distinctDays.has(twoDaysAgoKey);

  return hasToday && hasYesterday && hasTwoDaysAgo;
}

/**
 * Checks if user recently dismissed a recurring prompt for this title.
 */
export function isRecurringPromptDismissed(userId, title) {
  if (!userId) return false;
  try {
    const key = `${DISMISSED_RECURRING_PREFIX}${userId}_${normalizeTitle(title)}`;
    const stored = localStorage.getItem(key);
    if (!stored) return false;
    // Dismissal valid for 7 days
    const diff = Date.now() - Number(stored);
    return diff < 7 * 86400000;
  } catch {
    return false;
  }
}

/**
 * Records that the user dismissed the recurring suggestion for this title.
 */
export function setRecurringPromptDismissed(userId, title) {
  if (!userId) return;
  try {
    const key = `${DISMISSED_RECURRING_PREFIX}${userId}_${normalizeTitle(title)}`;
    localStorage.setItem(key, String(Date.now()));
  } catch (err) {
    console.warn('Failed to save recurring dismissal:', err);
  }
}

export function getCachedRecurringTasks(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(RECURRING_CACHE_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to load recurring tasks from localStorage:', err);
    return [];
  }
}

export function setCachedRecurringTasks(userId, items) {
  if (!userId) return;
  try {
    localStorage.setItem(RECURRING_CACHE_PREFIX + userId, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save recurring tasks to localStorage:', err);
  }
}

export function clearCachedRecurringTasks(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(RECURRING_CACHE_PREFIX + userId);
  } catch (err) {
    console.warn('Failed to clear recurring cache:', err);
  }
}

/**
 * Database helpers with graceful fallback
 */
export async function fetchRecurringFromDb() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('recurring_tasks')
      .select('id, user_id, title, color, created_at, last_spawned_date')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase recurring_tasks query failed (table may not exist yet, using local):', error.message);
      return null;
    }
    return data || [];
  } catch (err) {
    console.warn('Error fetching recurring tasks from DB:', err);
    return null;
  }
}

export async function insertRecurringInDb(item) {
  if (!isSupabaseConfigured) return item;
  try {
    const { data, error } = await supabase
      .from('recurring_tasks')
      .insert([item])
      .select()
      .single();

    if (error) {
      console.warn('Supabase recurring insert failed (fallback to local):', error.message);
      return item;
    }
    return data;
  } catch (err) {
    console.warn('Error inserting recurring task in DB:', err);
    return item;
  }
}

export async function deleteRecurringFromDb(id) {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase
      .from('recurring_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase recurring delete failed:', error.message);
    }
  } catch (err) {
    console.warn('Error deleting recurring task from DB:', err);
  }
}
