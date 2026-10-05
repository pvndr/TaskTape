import { supabase, isSupabaseConfigured } from './supabase';

const CACHE_PREFIX = 'tasktape_tasks_';

export function getCachedTasks(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to load tasks from localStorage:', err);
    return [];
  }
}

export function setCachedTasks(userId, tasks) {
  if (!userId) return;
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(tasks));
  } catch (err) {
    console.warn('Failed to save tasks to localStorage:', err);
  }
}

export function clearCachedTasks(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(CACHE_PREFIX + userId);
  } catch (err) {
    console.warn('Failed to clear cached tasks:', err);
  }
}

/**
 * Deterministically computes a rotation between +/- 1.0deg and 2.0deg based on task id.
 * Ensures rotation is generated once per task, clearly perceptible, and remains perfectly stable across renders and reloads.
 */
export function getRotationForId(id) {
  if (!id) return -1.2;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const sign = (hash & 1) === 0 ? 1 : -1;
  // Magnitude strictly between 1.0° and 2.0°
  const mag = 1.0 + ((Math.abs(hash) % 1000) / 1000) * 1.0;
  return Number((sign * mag).toFixed(2));
}

export async function fetchTasksFromDb() {
  if (!isSupabaseConfigured) {
    return null;
  }
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, title, done, color, created_at, completed_at, deleted_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function insertTaskInDb({ id, title, color, user_id, done = false, created_at, completed_at, deleted_at }) {
  if (!isSupabaseConfigured) {
    return {
      id,
      title,
      color,
      user_id,
      done,
      created_at: created_at || new Date().toISOString(),
      completed_at: completed_at || null,
      deleted_at: deleted_at || null
    };
  }
  const row = { id, user_id, title, color, done };
  if (created_at) row.created_at = created_at;
  if (completed_at !== undefined) row.completed_at = completed_at;
  if (deleted_at !== undefined) row.deleted_at = deleted_at;

  const { data, error } = await supabase
    .from('tasks')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTaskFieldsInDb(id, fields) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function updateTaskStatusInDb(id, done, completed_at = null) {
  return updateTaskFieldsInDb(id, { done, completed_at });
}

export async function deleteTaskFromDb(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
