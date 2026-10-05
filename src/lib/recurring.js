import { supabase, isSupabaseConfigured } from './supabase';

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
 */
export function normalizeTitle(title) {
  return (title || '').trim().toLowerCase();
}

/**
 * Checks if a task with the given title has been entered 3 consecutive days in a row
 * (Today, Yesterday, and 2 Days Ago) and is not already saved in the recurring list.
 */
export function checkThreeDayStreak(newTitle, tasks = [], recurringList = [], baseDate = new Date()) {
  const cleanTitle = normalizeTitle(newTitle);
  if (!cleanTitle) return false;

  // Already in recurring list?
  const alreadyRecurring = recurringList.some(
    (r) => normalizeTitle(r.title) === cleanTitle
  );
  if (alreadyRecurring) return false;

  // Find all non-permanently-deleted tasks with this normalized title
  const matchingTasks = tasks.filter(
    (t) => !t.deleted_at && normalizeTitle(t.title) === cleanTitle
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
