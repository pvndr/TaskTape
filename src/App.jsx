import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import {
  getCachedTasks,
  setCachedTasks,
  clearCachedTasks,
  fetchTasksFromDb,
  insertTaskInDb,
  updateTaskFieldsInDb,
  deleteTaskFromDb
} from './lib/tasks';
import AuthForm from './components/AuthForm';
import FilterChips from './components/FilterChips';
import TaskList from './components/TaskList';
import AddBar from './components/AddBar';
import UndoSnackbar from './components/UndoSnackbar';
import Toast from './components/Toast';
import ProfilePopover, { getUserInitials } from './components/ProfilePopover';
import OldestTaskNudge, {
  getOldestActiveTask,
  getAgeInWholeDays
} from './components/OldestTaskNudge';
import { unsubscribePushDevice } from './lib/push';
import {
  checkThreeDayStreak,
  isRecurringPromptDismissed,
  setRecurringPromptDismissed,
  getCachedRecurringTasks,
  setCachedRecurringTasks,
  clearCachedRecurringTasks,
  fetchRecurringFromDb,
  insertRecurringInDb,
  deleteRecurringFromDb
} from './lib/recurring';
import RecurringPrompt from './components/RecurringPrompt';
import RecurringSection from './components/RecurringSection';
import { BuddyProvider, useBuddy, Buddy } from './buddy';

function AppContent() {
  const buddy = useBuddy();

  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === 'true') {
        localStorage.removeItem('tasktape_buddy_greeting_demo-user');
        sessionStorage.removeItem('tasktape_buddy_session_welcomed');
        sessionStorage.removeItem('tasktape_buddy_last_active');
      }
    }
  }, []);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [streakPrompt, setStreakPrompt] = useState(null);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState({ message: '', variant: 'error' });

  // Separate queues: hard deletes have 5s DB deletion timer; soft-clears are saved immediately and only snackbar expires
  const [pendingHardDeletes, setPendingHardDeletes] = useState([]);
  const [pendingSoftClears, setPendingSoftClears] = useState([]);

  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Oldest task nudge states
  const [activeNudgeTask, setActiveNudgeTask] = useState(null);
  const [nudgeAgeDays, setNudgeAgeDays] = useState(0);
  const [isAddBarFocused, setIsAddBarFocused] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  // Ref to avatar button to return focus when popover closes
  const avatarButtonRef = useRef(null);

  // Ref to hold current pending hard deletes strictly for synchronous DB deletion on pagehide/signout
  const pendingHardDeletesRef = useRef([]);
  pendingHardDeletesRef.current = pendingHardDeletes;

  const user = session?.user;
  const userId = user?.id;

  const showToast = (message, variant = 'error') => {
    setToast({ message, variant });
  };

  const getLocalTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check and evaluate oldest active task nudge eligibility (ignores cleared tasks)
  const evaluateNudge = useCallback((currentTasks = tasks, addBarFocused = isAddBarFocused) => {
    if (!userId || !user) {
      setActiveNudgeTask(null);
      return;
    }

    const nudgesEnabled = user.user_metadata?.nudges_enabled !== false;
    if (!nudgesEnabled) {
      setActiveNudgeTask(null);
      return;
    }

    if (addBarFocused) {
      return;
    }

    const todayStr = getLocalTodayDateString();
    const storageKey = isDemo ? 'tasktape_nudge_dismissed_demo' : `tasktape_nudge_dismissed_${userId}`;
    const dismissedDate = localStorage.getItem(storageKey);
    if (dismissedDate === todayStr) {
      setActiveNudgeTask(null);
      return;
    }

    const oldest = getOldestActiveTask(currentTasks);
    if (!oldest) {
      setActiveNudgeTask(null);
      return;
    }

    const age = getAgeInWholeDays(oldest.created_at);
    if (age >= 2) {
      setActiveNudgeTask(oldest);
      setNudgeAgeDays(age);
    } else {
      setActiveNudgeTask(null);
    }
  }, [userId, user, tasks, isAddBarFocused, isDemo]);

  // Recompute date and groups when returning to foreground or at local midnight
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setCurrentDate(new Date());
        evaluateNudge();
        if (userId) {
          buddy.onUserResumeSession?.(userId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let timerId;
    const scheduleMidnightCheck = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
      timerId = setTimeout(() => {
        setCurrentDate(new Date());
        scheduleMidnightCheck();
      }, delay);
    };

    scheduleMidnightCheck();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timerId);
    };
  }, [evaluateNudge]);

  // Re-evaluate when tasks change or addBar focus changes
  useEffect(() => {
    if (!tasksLoading && userId) {
      evaluateNudge(tasks, isAddBarFocused);
    }
  }, [tasks, tasksLoading, userId, isAddBarFocused, evaluateNudge]);

  // Natural once-per-day Buddy companion greeting
  useEffect(() => {
    if (userId) {
      buddy.checkDailyGreeting(userId);
    }
  }, [userId, buddy]);

  // Periodic task reminder evaluation (subject to strict non-annoying cooldowns)
  useEffect(() => {
    if (!userId || tasksLoading || tasks.length === 0) return;

    const isBannerVisible = Boolean(activeNudgeTask && !isAddBarFocused);
    buddy.evaluateTaskReminders(tasks, isBannerVisible);

    const reminderInterval = setInterval(() => {
      const currentlyVisible = Boolean(activeNudgeTask && !isAddBarFocused);
      buddy.evaluateTaskReminders(tasks, currentlyVisible);
    }, 45000);

    return () => clearInterval(reminderInterval);
  }, [userId, tasks, tasksLoading, activeNudgeTask, isAddBarFocused, buddy]);

  // Handle visualViewport for mobile virtual keyboard resize and no layout shift
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    handleResize();

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);

  // Flush pending hard deletes to database immediately (soft-clears are already saved immediately)
  const flushPendingDeletes = useCallback(async () => {
    const list = [...pendingHardDeletesRef.current];
    if (list.length === 0) return;

    list.forEach((item) => clearTimeout(item.timerId));
    setPendingHardDeletes([]);

    if (isDemo) return;

    await Promise.all(
      list.map((item) => deleteTaskFromDb(item.task.id).catch((err) => {
        console.error('Failed to flush delete for', item.task.id, err);
      }))
    );
  }, [isDemo]);

  // Flush on pagehide
  useEffect(() => {
    const handlePageHide = () => {
      flushPendingDeletes();
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushPendingDeletes]);

  // Auth session listener
  useEffect(() => {
    if (isDemo) {
      const demoSession = {
        user: {
          id: 'demo-user',
          email: 'demo@tasktape.app',
          user_metadata: { display_name: 'Tape Fan', nudges_enabled: true }
        }
      };
      setSession(demoSession);

      const nowMs = Date.now();
      const demoTasks = [
        // Active tasks (Today)
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'demo-user',
          title: 'Design day-wise tape headers in Caveat',
          color: 'tape-teal',
          done: false,
          created_at: new Date(nowMs - 3600000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        {
          id: '11111111-1111-4111-8111-222222222222',
          user_id: 'demo-user',
          title: 'Water the studio ficus tree',
          color: 'tape-sage',
          done: false,
          created_at: new Date(nowMs - 7200000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        {
          id: '11111111-1111-4111-8111-333333333333',
          user_id: 'demo-user',
          title: 'Test momentum scrolling in mobile emulation',
          color: 'tape-mustard',
          done: false,
          created_at: new Date(nowMs - 14400000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        // Active tasks (Yesterday & 2 days ago for streak demo)
        {
          id: '22222222-2222-4222-8222-111111111111',
          user_id: 'demo-user',
          title: 'Ship package with brown kraft paper & tape',
          color: 'tape-mustard',
          done: false,
          created_at: new Date(nowMs - 2 * 86400000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          user_id: 'demo-user',
          title: 'Ship package with brown kraft paper & tape',
          color: 'tape-mustard',
          done: false,
          created_at: new Date(nowMs - 86400000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        {
          id: '22222222-2222-4222-8222-333333333333',
          user_id: 'demo-user',
          title: 'Order matte black fine-tip gel pens',
          color: 'tape-cream',
          done: false,
          created_at: new Date(nowMs - 90000000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        // Active tasks (Older / 3-5 days ago)
        {
          id: '33333333-3333-4333-8333-111111111111',
          user_id: 'demo-user',
          title: 'Pick up freshly roasted espresso beans',
          color: 'tape-cream',
          done: false,
          created_at: new Date(nowMs - 3 * 86400000).toISOString(), // 3 days ago (nudge eligible)
          completed_at: null,
          deleted_at: null
        },
        {
          id: '33333333-3333-4333-8333-222222222222',
          user_id: 'demo-user',
          title: 'Sand down oak desk work surface',
          color: 'tape-red',
          done: false,
          created_at: new Date(nowMs - 4 * 86400000).toISOString(),
          completed_at: null,
          deleted_at: null
        },
        {
          id: '33333333-3333-4333-8333-444444444444',
          user_id: 'demo-user',
          title: 'Draft release notes for TaskTape v1.2',
          color: 'tape-teal',
          done: false,
          created_at: new Date(nowMs - 5 * 86400000).toISOString(),
          completed_at: null,
          deleted_at: null
        },

        // Completed tasks (Today)
        {
          id: '44444444-4444-4444-8444-111111111111',
          user_id: 'demo-user',
          title: 'Review PWA manifest & offline precache',
          color: 'tape-sage',
          done: true,
          created_at: new Date(nowMs - 2 * 86400000).toISOString(),
          completed_at: new Date(nowMs - 1800000).toISOString(), // Today
          deleted_at: null
        },
        {
          id: '44444444-4444-4444-8444-222222222222',
          user_id: 'demo-user',
          title: 'Verify workbox routing fallback',
          color: 'tape-teal',
          done: true,
          created_at: new Date(nowMs - 86400000).toISOString(),
          completed_at: new Date(nowMs - 3600000).toISOString(), // Today
          deleted_at: null
        },
        {
          id: '44444444-4444-4444-8444-333333333333',
          user_id: 'demo-user',
          title: 'Organize masking tape color palette swatches',
          color: 'tape-mustard',
          done: true,
          created_at: new Date(nowMs - 86400000).toISOString(),
          completed_at: new Date(nowMs - 5400000).toISOString(), // Today
          deleted_at: null
        },
        // Completed tasks (Yesterday)
        {
          id: '55555555-5555-4555-8555-111111111111',
          user_id: 'demo-user',
          title: 'Cut fresh rolls of washi tape',
          color: 'tape-red',
          done: true,
          created_at: new Date(nowMs - 3 * 86400000).toISOString(),
          completed_at: new Date(nowMs - 86400000).toISOString(), // Yesterday
          deleted_at: null
        },
        {
          id: '55555555-5555-4555-8555-222222222222',
          user_id: 'demo-user',
          title: 'Refactor auth state listener',
          color: 'tape-cream',
          done: true,
          created_at: new Date(nowMs - 3 * 86400000).toISOString(),
          completed_at: new Date(nowMs - 90000000).toISOString(), // Yesterday
          deleted_at: null
        },
        // Completed tasks (Earlier)
        {
          id: '66666666-6666-4666-8666-111111111111',
          user_id: 'demo-user',
          title: 'Set up push notification edge function',
          color: 'tape-teal',
          done: true,
          created_at: new Date(nowMs - 6 * 86400000).toISOString(),
          completed_at: new Date(nowMs - 3 * 86400000).toISOString(),
          deleted_at: null
        },
        {
          id: '66666666-6666-4666-8666-222222222222',
          user_id: 'demo-user',
          title: 'Benchmark bundle size with injectManifest',
          color: 'tape-sage',
          done: true,
          created_at: new Date(nowMs - 6 * 86400000).toISOString(),
          completed_at: new Date(nowMs - 4 * 86400000).toISOString(),
          deleted_at: null
        },
        {
          id: '66666666-6666-4666-8666-333333333333',
          user_id: 'demo-user',
          title: 'Legacy completed tape task (cleared)',
          color: 'tape-cream',
          done: true,
          created_at: new Date(nowMs - 7 * 86400000).toISOString(),
          completed_at: null,
          deleted_at: new Date(nowMs - 600000).toISOString() // Cleared!
        }
      ];
      setTasks(demoTasks);
      const demoCachedRecurring = getCachedRecurringTasks('demo-user');
      if (demoCachedRecurring && demoCachedRecurring.length > 0) {
        setRecurringTasks(demoCachedRecurring);
      } else {
        const demoRecurring = [
          {
            id: 'demo-rec-1',
            user_id: 'demo-user',
            title: 'Water the studio ficus tree',
            color: 'tape-sage',
            created_at: new Date(nowMs - 3 * 86400000).toISOString(),
            last_spawned_date: null
          }
        ];
        setRecurringTasks(demoRecurring);
      }
      setTasksLoading(false);
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isDemo]);

  // Fetch tasks on user login with instant localStorage paint then refresh
  useEffect(() => {
    if (!userId || isDemo) {
      if (!isDemo) {
        setTasks([]);
        setRecurringTasks([]);
        setTasksLoading(false);
      }
      return;
    }

    const cached = getCachedTasks(userId);
    if (cached && cached.length > 0) {
      setTasks(cached);
      setTasksLoading(false);
    } else {
      setTasksLoading(true);
    }

    const cachedRecurring = getCachedRecurringTasks(userId);
    if (cachedRecurring && cachedRecurring.length > 0) {
      setRecurringTasks(cachedRecurring);
    }

    fetchTasksFromDb()
      .then((data) => {
        if (data !== null) {
          setTasks(data);
          setCachedTasks(userId, data);
        }
      })
      .catch((err) => {
        console.error('Error fetching tasks from DB:', err);
        if (!cached || cached.length === 0) {
          showToast('Could not connect to database. Check network or credentials.');
        }
      })
      .finally(() => {
        setTasksLoading(false);
      });

    fetchRecurringFromDb()
      .then((data) => {
        if (data !== null) {
          setRecurringTasks(data);
          setCachedRecurringTasks(userId, data);
        }
      })
      .catch((err) => {
        console.warn('Error fetching recurring tasks from DB:', err);
      });
  }, [userId, isDemo]);

  // Sign out handler: flush pending deletes, close profile popover, and clear user cache
  const handleSignOut = async () => {
    setIsProfileOpen(false);
    await flushPendingDeletes();

    // Best-effort push device unsubscribe
    try {
      await unsubscribePushDevice(isDemo);
    } catch (err) {
      console.warn('Push unsubscribe on signout ignored error:', err);
    }

    if (isDemo) {
      setTasks([]);
      setRecurringTasks([]);
      setStreakPrompt(null);
      setActiveNudgeTask(null);
      setSession(null);
      return;
    }

    if (userId) {
      clearCachedTasks(userId);
      clearCachedRecurringTasks(userId);
    }
    setTasks([]);
    setRecurringTasks([]);
    setStreakPrompt(null);
    setActiveNudgeTask(null);
    await supabase.auth.signOut();
  };

  // Update display name via Supabase Auth user_metadata
  const handleUpdateDisplayName = async (newName) => {
    const trimmed = newName.trim().slice(0, 30);
    if (isDemo) {
      setSession((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          user_metadata: {
            ...prev.user?.user_metadata,
            display_name: trimmed
          }
        }
      }));
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: trimmed }
    });

    if (error) {
      console.error('Failed to update display name:', error);
      showToast('Failed to update display name: ' + error.message, 'error');
      throw error;
    }

    if (data?.user) {
      setSession((prev) => ({ ...prev, user: data.user }));
    }
  };

  // Update friendly reminders toggle via Supabase Auth user_metadata
  const handleToggleNudges = async (enabled) => {
    if (isDemo) {
      setSession((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          user_metadata: {
            ...prev.user?.user_metadata,
            nudges_enabled: enabled
          }
        }
      }));
      if (!enabled) setActiveNudgeTask(null);
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { nudges_enabled: enabled }
    });

    if (error) {
      console.error('Failed to update reminder settings:', error);
      showToast('Failed to update reminder settings: ' + error.message, 'error');
      return;
    }

    if (data?.user) {
      setSession((prev) => ({ ...prev, user: data.user }));
      if (!enabled) setActiveNudgeTask(null);
    }
  };

  // Nudge actions
  const handleAcceptNudge = () => {
    if (!activeNudgeTask) return;
    const targetId = activeNudgeTask.id;
    const todayStr = getLocalTodayDateString();
    const storageKey = isDemo ? 'tasktape_nudge_dismissed_demo' : `tasktape_nudge_dismissed_${userId}`;
    if (userId) {
      localStorage.setItem(storageKey, todayStr);
    }
    setActiveNudgeTask(null);

    // If currently filtering out active tasks, switch to all
    if (filter === 'done') {
      setFilter('all');
    }

    setTimeout(() => {
      const el = document.getElementById(`task-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);

    // Gentle glow (~1.2s)
    setHighlightedTaskId(targetId);
    setTimeout(() => {
      setHighlightedTaskId((prev) => (prev === targetId ? null : prev));
    }, 1250);
  };

  const handleDismissNudge = () => {
    const todayStr = getLocalTodayDateString();
    const storageKey = isDemo ? 'tasktape_nudge_dismissed_demo' : `tasktape_nudge_dismissed_${userId}`;
    if (userId) {
      localStorage.setItem(storageKey, todayStr);
    }
    setActiveNudgeTask(null);
  };

  // Add Task with client-side UUID
  const handleAddTask = async ({ title, color }) => {
    if (!userId) return;

    const newTask = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      color,
      done: false,
      justAdded: true,
      created_at: new Date().toISOString(),
      completed_at: null,
      deleted_at: null
    };

    const previousTasks = [...tasks];
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    buddy.onTaskCreated(title);

    // Check for 3-day consecutive streak
    const hasStreak = checkThreeDayStreak(title, updatedTasks, recurringTasks, new Date());
    if (hasStreak && !isRecurringPromptDismissed(userId, title)) {
      setStreakPrompt({ title, color });
    }

    if (isDemo) {
      return;
    }

    setCachedTasks(userId, updatedTasks);

    try {
      await insertTaskInDb(newTask);
    } catch (err) {
      console.error('Failed to add task:', err);
      setTasks(previousTasks);
      setCachedTasks(userId, previousTasks);
      showToast('Failed to stick task. Rolled back.', 'error');
    }
  };

  // Recurring Event Handlers
  const handleAcceptRecurring = async () => {
    if (!streakPrompt || !userId) return;
    const { title, color } = streakPrompt;
    setStreakPrompt(null);

    const newRecurring = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      color: color || 'tape-teal',
      created_at: new Date().toISOString(),
      last_spawned_date: null
    };

    const updatedRecurring = [newRecurring, ...recurringTasks];
    setRecurringTasks(updatedRecurring);
    if (!isDemo) setCachedRecurringTasks(userId, updatedRecurring);

    showToast(`📌 "${title}" saved to Recurring Events!`, 'info');

    if (!isDemo) {
      try {
        await insertRecurringInDb(newRecurring);
      } catch (err) {
        console.warn('Failed to persist recurring task to DB:', err);
      }
    }
  };

  const handleDismissRecurring = () => {
    if (!streakPrompt) return;
    if (userId) {
      setRecurringPromptDismissed(userId, streakPrompt.title);
    }
    setStreakPrompt(null);
  };

  const handleRemoveRecurring = async (item) => {
    if (!userId) return;
    const updatedRecurring = recurringTasks.filter((r) => r.id !== item.id);
    setRecurringTasks(updatedRecurring);
    if (!isDemo) setCachedRecurringTasks(userId, updatedRecurring);
    showToast(`Removed "${item.title}" from recurring events.`, 'info');

    if (!isDemo) {
      try {
        await deleteRecurringFromDb(item.id);
      } catch (err) {
        console.warn('Failed to delete recurring task from DB:', err);
      }
    }
  };

  const handleStickRecurringToday = (item) => {
    handleAddTask({ title: item.title, color: item.color });
    showToast(`Taped "${item.title}" for today!`, 'info');
  };

  // Toggle Done status (checkbox)
  // Marking done sets completed_at; un-completing sets both completed_at and deleted_at to null
  const handleToggleTask = async (id, nextDone) => {
    if (!userId) return;

    if (nextDone) {
      const targetTask = tasks.find((t) => t.id === id);
      const remainingCount = tasks.filter((t) => !t.deleted_at && t.id !== id && !t.done).length;
      buddy.onTaskCompleted(targetTask?.title, remainingCount);

      const oldestActive = getOldestActiveTask(tasks);
      if (oldestActive && oldestActive.id === id) {
        showToast('Nice, that was the longest-waiting one.', 'info');
        if (activeNudgeTask?.id === id) {
          setActiveNudgeTask(null);
        }
      }
    } else {
      const targetTask = tasks.find((t) => t.id === id);
      buddy.onTaskUncompleted?.(targetTask?.title);
    }

    const previousTasks = [...tasks];
    let fieldsToUpdate;
    let updatedTasks;

    if (nextDone) {
      const completed_at = new Date().toISOString();
      fieldsToUpdate = { done: true, completed_at };
      updatedTasks = tasks.map((t) => (t.id === id ? { ...t, done: true, completed_at } : t));
    } else {
      // Un-completing sets completed_at and deleted_at both to null
      fieldsToUpdate = { done: false, completed_at: null, deleted_at: null };
      updatedTasks = tasks.map((t) =>
        t.id === id ? { ...t, done: false, completed_at: null, deleted_at: null } : t
      );
    }

    setTasks(updatedTasks);
    if (!isDemo) setCachedTasks(userId, updatedTasks);

    if (isDemo) return;

    try {
      // Partial update helper sends ONLY the columns being changed
      await updateTaskFieldsInDb(id, fieldsToUpdate);
    } catch (err) {
      console.error('Failed to update task status:', err);
      setTasks(previousTasks);
      setCachedTasks(userId, previousTasks);
      showToast('Failed to update task. Rolled back.', 'error');
    }
  };

  // Soft clear: sets deleted_at = now immediately; Undo sets deleted_at back to null
  const handleClearTask = async (task) => {
    if (!userId) return;

    const deleted_at = new Date().toISOString();
    const previousTasks = [...tasks];
    const updatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, deleted_at } : t));
    setTasks(updatedTasks);
    if (!isDemo) setCachedTasks(userId, updatedTasks);

    // Independent timer to auto-dismiss the snackbar after 5s
    const timerId = setTimeout(() => {
      setPendingSoftClears((prev) => prev.filter((p) => p.id !== task.id));
    }, 5000);

    setPendingSoftClears((prev) => [
      ...prev.filter((p) => p.id !== task.id),
      { id: task.id, task, timerId, type: 'clear' }
    ]);

    if (isDemo) return;

    try {
      // Partial update helper sends ONLY deleted_at
      await updateTaskFieldsInDb(task.id, { deleted_at });
    } catch (err) {
      console.error('Failed to clear task from list:', err);
      setTasks(previousTasks);
      setCachedTasks(userId, previousTasks);
      setPendingSoftClears((prev) => prev.filter((p) => p.id !== task.id));
      showToast('Failed to clear task. Rolled back.', 'error');
    }
  };

  // Restore cleared task: sets deleted_at = null
  const handleRestoreTask = async (task) => {
    if (!userId) return;

    const previousTasks = [...tasks];
    const updatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, deleted_at: null } : t));
    setTasks(updatedTasks);
    if (!isDemo) setCachedTasks(userId, updatedTasks);

    if (isDemo) return;

    try {
      // Partial update helper sends ONLY deleted_at: null
      await updateTaskFieldsInDb(task.id, { deleted_at: null });
    } catch (err) {
      console.error('Failed to restore task:', err);
      setTasks(previousTasks);
      setCachedTasks(userId, previousTasks);
      showToast('Failed to restore task. Rolled back.', 'error');
    }
  };

  // Hard delete: Active task × or "Delete forever" on completed task (5s Undo timer)
  const handleDeleteTask = (task) => {
    if (!userId) return;

    if (activeNudgeTask?.id === task.id) {
      setActiveNudgeTask(null);
    }

    const previousTasks = [...tasks];
    const remainingTasks = tasks.filter((t) => t.id !== task.id);
    setTasks(remainingTasks);

    if (isDemo) {
      const timerId = setTimeout(() => {
        setPendingHardDeletes((prev) => prev.filter((p) => p.id !== task.id));
      }, 5000);
      setPendingHardDeletes((prev) => [
        ...prev.filter((p) => p.id !== task.id),
        { id: task.id, task, timerId, previousTasks, type: 'delete' }
      ]);
      return;
    }

    setCachedTasks(userId, remainingTasks);

    const timerId = setTimeout(async () => {
      try {
        await deleteTaskFromDb(task.id);
      } catch (err) {
        console.error('Failed to permanently delete task:', err);
        showToast('Failed to delete task from server.', 'error');
      } finally {
        setPendingHardDeletes((prev) => prev.filter((p) => p.id !== task.id));
      }
    }, 5000);

    setPendingHardDeletes((prev) => [
      ...prev.filter((p) => p.id !== task.id),
      { id: task.id, task, timerId, previousTasks, type: 'delete' }
    ]);
  };

  // Unified Undo handler for either a soft clear or a hard delete
  const handleUndo = async (pendingAction) => {
    if (!pendingAction) return;

    if (pendingAction.type === 'clear') {
      clearTimeout(pendingAction.timerId);
      setPendingSoftClears((prev) => prev.filter((p) => p.id !== pendingAction.id));

      const previousTasks = [...tasks];
      const updatedTasks = tasks.map((t) =>
        t.id === pendingAction.id ? { ...t, deleted_at: null } : t
      );
      setTasks(updatedTasks);
      if (!isDemo) setCachedTasks(userId, updatedTasks);

      if (isDemo) return;

      try {
        await updateTaskFieldsInDb(pendingAction.id, { deleted_at: null });
      } catch (err) {
        console.error('Failed to undo clear:', err);
        setTasks(previousTasks);
        setCachedTasks(userId, previousTasks);
        showToast('Failed to undo clear. Rolled back.', 'error');
      }
    } else {
      // Hard delete Undo
      clearTimeout(pendingAction.timerId);
      setPendingHardDeletes((prev) => prev.filter((p) => p.id !== pendingAction.id));

      const restoredTask = { ...pendingAction.task, isRestored: true };
      setTasks((prev) => {
        const restored = [restoredTask, ...prev];
        if (userId && !isDemo) setCachedTasks(userId, restored);
        return restored;
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full h-dvh bg-kraft" style={{ height: 'var(--app-height, 100dvh)' }}>
        <div className="px-6 py-3 bg-tape-mustard torn-tape tape-shadow animate-pulse">
          <span className="font-hand text-2xl text-kraft-dark font-bold">
            Unrolling TaskTape...
          </span>
        </div>
      </div>
    );
  }

  // Active snackbar action: latest soft clear or latest hard delete
  const activeUndoAction =
    pendingSoftClears[pendingSoftClears.length - 1] ||
    pendingHardDeletes[pendingHardDeletes.length - 1] ||
    null;

  // Counts strictly exclude cleared tasks (deleted_at is set)
  const nonClearedTasks = tasks.filter((t) => !t.deleted_at);
  const activeNonClearedCount = nonClearedTasks.filter((t) => !t.done).length;
  const totalNonClearedCount = nonClearedTasks.length;

  return (
    <div
      className="h-full h-dvh max-h-dvh flex flex-col justify-between bg-kraft text-kraft-dark selection:bg-tape-mustard selection:text-black overflow-hidden"
      style={{ height: 'var(--app-height, 100dvh)', maxHeight: 'var(--app-height, 100dvh)' }}
    >
      {/* Toast */}
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'error' })}
      />

      {/* Floating Undo Snackbar for both soft clears and hard deletes */}
      <UndoSnackbar
        pendingAction={activeUndoAction}
        onUndo={handleUndo}
      />

      {/* Main content wrapper */}
      <div className="flex-1 min-h-0 flex flex-col w-full max-w-md mx-auto overflow-hidden relative">
        {/* Header */}
        <header className="shrink-0 pt-safe px-4 py-3 flex items-center justify-between border-b border-kraft-border/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-5 bg-tape-cream torn-tape tape-shadow transform -rotate-3 flex items-center justify-center border border-black/10">
              <span className="text-[10px] font-bold">TT</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight font-sans text-kraft-dark">
              Task<span className="text-amber-900">Tape</span>
            </h1>
          </div>

          {session && (
            <div className="relative">
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                aria-label="Open profile menu"
                aria-haspopup="dialog"
                aria-expanded={isProfileOpen}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold font-sans transform -rotate-2 transition-all select-none shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft-dark focus-visible:ring-offset-2 focus-visible:ring-offset-kraft ${
                  isProfileOpen
                    ? 'bg-tape-mustard border-kraft-dark text-kraft-dark ring-2 ring-kraft-dark ring-offset-1 ring-offset-kraft scale-105 shadow-md'
                    : 'bg-tape-cream border-black/15 text-kraft-dark tape-shadow hover:scale-105 active:scale-95'
                }`}
              >
                {getUserInitials(user)}
              </button>

              <ProfilePopover
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                user={user}
                tasks={tasks}
                onSignOut={handleSignOut}
                onUpdateName={handleUpdateDisplayName}
                onToggleNudges={handleToggleNudges}
                onToast={showToast}
                avatarRef={avatarButtonRef}
              />
            </div>
          )}
        </header>

        {/* Main Body */}
        <main className="flex-1 min-h-0 px-3 py-2 flex flex-col overflow-hidden">
          {!session ? (
            <div className="flex-1 min-h-0 overflow-y-auto scroll-touch">
              <AuthForm onAuthSuccess={(newSession) => setSession(newSession)} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Filter chips & done counter: counts only non-cleared tasks */}
              <div className="shrink-0">
                <FilterChips
                  currentFilter={filter}
                  onFilterChange={setFilter}
                  activeCount={activeNonClearedCount}
                  totalCount={totalNonClearedCount}
                  loading={tasksLoading}
                />
              </div>

              {/* Task Strips List with Oldest Task Nudge directly above */}
              <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1 scroll-touch pb-28">
                {streakPrompt && !isAddBarFocused && (
                  <RecurringPrompt
                    title={streakPrompt.title}
                    color={streakPrompt.color}
                    onAccept={handleAcceptRecurring}
                    onDismiss={handleDismissRecurring}
                  />
                )}

                {activeNudgeTask && !isAddBarFocused && (
                  <OldestTaskNudge
                    task={activeNudgeTask}
                    ageDays={nudgeAgeDays}
                    onAccept={handleAcceptNudge}
                    onDismiss={handleDismissNudge}
                  />
                )}

                {/* Recurring Events section shown on All and Active views */}
                {filter !== 'done' && (
                  <RecurringSection
                    recurringTasks={recurringTasks}
                    currentTasks={tasks}
                    onStickToday={handleStickRecurringToday}
                    onRemoveRecurring={handleRemoveRecurring}
                    now={currentDate}
                  />
                )}

                <TaskList
                  tasks={tasks}
                  filter={filter}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onClear={handleClearTask}
                  onRestore={handleRestoreTask}
                  loading={tasksLoading}
                  highlightedTaskId={highlightedTaskId}
                  now={currentDate}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Buddy Companion Layer: living character anchored beside task board / bottom-right */}
      {session && <Buddy />}

      {/* Add Bar pinned to bottom when signed in */}
      {session && (
        <AddBar
          onAddTask={handleAddTask}
          onFocusChange={setIsAddBarFocused}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BuddyProvider>
      <AppContent />
    </BuddyProvider>
  );
}

