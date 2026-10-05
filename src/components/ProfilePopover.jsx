import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  urlBase64ToUint8Array,
  isPushSupported,
  isIosNonStandalone,
  getServiceWorkerReady,
  getCurrentPushSubscription,
  unsubscribePushDevice
} from '../lib/push';

export function getUserDisplayName(user) {
  if (!user) return 'User';
  const custom = user.user_metadata?.display_name?.trim();
  if (custom) return custom.slice(0, 30);
  const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
  return emailPrefix.slice(0, 30);
}

export function getUserInitials(user) {
  if (!user) return 'U';
  const custom = user.user_metadata?.display_name?.trim();
  if (custom) {
    const words = custom.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    if (words.length === 1 && words[0].length >= 2) {
      return words[0].slice(0, 2).toUpperCase();
    }
    if (words.length === 1 && words[0].length === 1) {
      return words[0].toUpperCase();
    }
  }
  const emailPrefix = user.email ? user.email.split('@')[0] : 'U';
  return (emailPrefix.charAt(0) || 'U').toUpperCase();
}

export default function ProfilePopover({
  isOpen,
  onClose,
  user,
  tasks = [],
  onSignOut,
  onUpdateName,
  onToggleNudges,
  onToast,
  avatarRef
}) {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true';

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Push notification state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [remindHour, setRemindHour] = useState(9);
  const [pushLoading, setPushLoading] = useState(false);
  const [updatingHour, setUpdatingHour] = useState(false);
  const [permissionState, setPermissionState] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const popoverRef = useRef(null);
  const editInputRef = useRef(null);

  const displayName = getUserDisplayName(user);
  const nonClearedTasks = tasks.filter((t) => !t.deleted_at);
  const totalStuck = nonClearedTasks.length;
  const totalDone = nonClearedTasks.filter((t) => t.done).length;
  const nudgesEnabled = user?.user_metadata?.nudges_enabled !== false;

  // Check push subscription state when popover opens
  useEffect(() => {
    if (!isOpen || !isPushSupported()) return;

    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }

    let isMounted = true;
    (async () => {
      if (isDemo) {
        const demoSub = localStorage.getItem('tasktape_demo_push_sub');
        if (isMounted && demoSub) {
          setIsSubscribed(true);
          const hour = parseInt(localStorage.getItem('tasktape_demo_push_hour') || '9', 10);
          setRemindHour(hour);
        }
        return;
      }

      try {
        const sub = await getCurrentPushSubscription();
        if (!isMounted) return;
        if (sub) {
          setIsSubscribed(true);
          const { data } = await supabase
            .from('push_subscriptions')
            .select('remind_hour')
            .eq('endpoint', sub.endpoint)
            .maybeSingle();

          if (isMounted && data && data.remind_hour !== null && data.remind_hour !== undefined) {
            setRemindHour(data.remind_hour);
          }
        } else {
          setIsSubscribed(false);
        }
      } catch (err) {
        console.warn('Could not check current push subscription:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, isDemo]);

  const handleEnablePush = async () => {
    if (!vapidPublicKey) return;
    setPushLoading(true);

    try {
      if (isDemo) {
        localStorage.setItem('tasktape_demo_push_sub', 'true');
        localStorage.setItem('tasktape_demo_push_hour', String(remindHour));
        setIsSubscribed(true);
        setPushLoading(false);
        return;
      }

      // 1. Request permission from user tap
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm !== 'granted') {
        setPushLoading(false);
        return;
      }

      // 2. Await service worker ready with 8s timeout
      const reg = await getServiceWorkerReady(8000);
      if (!reg) {
        throw new Error('Service worker is unavailable. Please try again.');
      }

      // 3. Subscribe via pushManager
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey
      });

      // 4. Extract keys & tz
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      // 5. Upsert into push_subscriptions
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh,
            auth,
            remind_hour: remindHour,
            tz
          },
          { onConflict: 'endpoint' }
        );

      if (error) throw error;

      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to enable push notifications:', err);
      onToast?.('Could not enable phone notifications: ' + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      if (isDemo) {
        localStorage.removeItem('tasktape_demo_push_sub');
        localStorage.removeItem('tasktape_demo_push_hour');
        setIsSubscribed(false);
        setPushLoading(false);
        return;
      }

      await unsubscribePushDevice(isDemo);
      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to disable push notifications:', err);
      onToast?.('Could not disable phone notifications.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleUpdateHour = async (newHour) => {
    setRemindHour(newHour);
    if (isDemo) {
      localStorage.setItem('tasktape_demo_push_hour', String(newHour));
      return;
    }

    setUpdatingHour(true);
    try {
      const sub = await getCurrentPushSubscription();
      if (!sub) return;

      const { error } = await supabase
        .from('push_subscriptions')
        .update({ remind_hour: newHour })
        .eq('endpoint', sub.endpoint);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update reminder hour:', err);
      onToast?.('Failed to update reminder hour.');
    } finally {
      setUpdatingHour(false);
    }
  };

  // Handle focus, Escape key, and outside clicks
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        avatarRef?.current?.focus();
      }
    };

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        !avatarRef?.current?.contains(e.target)
      ) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    // Initial focus on popover container
    popoverRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose, avatarRef]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setNameInput(displayName);
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 50);
    }
  }, [isEditing, displayName]);

  const handleStartEditing = () => {
    setNameInput(displayName);
    setIsEditing(true);
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim().slice(0, 30);
    if (!trimmed) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onUpdateName(trimmed);
      setIsEditing(false);
    } catch {
      // Error handled by parent toast
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutClick = async () => {
    onClose();
    await onSignOut();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover / Bottom Sheet Container
          Narrow screens (< md): fixed bottom sheet sliding up from bottom
          Desktop (md:): positioned to the right of the avatar and tasks (left-full top-0 ml-4) */}
      <div
        ref={popoverRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="User profile"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-5 pb-safe border-t border-kraft-border/70 bg-kraft-card shadow-2xl animate-slide-settle focus:outline-none md:absolute md:inset-auto md:left-full md:top-0 md:ml-4 md:w-72 md:rounded-xl md:border md:border-kraft-border/70 md:pb-5 md:shadow-xl md:z-40"
      >
        {/* Top decorative tape strip with increased text size */}
        <div className="w-28 h-6 mx-auto -mt-8 mb-3 bg-tape-mustard torn-tape tape-shadow transform -rotate-1 flex items-center justify-center border border-black/10 select-none">
          <span className="text-xs font-bold font-hand text-kraft-dark tracking-wider">
            TapeCard
          </span>
        </div>

        {/* Header with greeting and close button */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-bold font-hand text-kraft-dark truncate">
              Hi, {displayName}
            </h3>
            <p className="text-xs text-kraft-dark/65 font-sans truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              avatarRef?.current?.focus();
            }}
            aria-label="Close profile"
            className="shrink-0 p-1 text-kraft-dark/50 hover:text-kraft-dark text-xs font-bold rounded hover:bg-black/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Inline editable display name */}
        <div className="my-3 py-2 px-3 rounded-lg bg-black/5 border border-kraft-border/50">
          <div className="flex items-center justify-between text-[11px] font-sans font-bold uppercase tracking-wider text-kraft-dark/70 mb-1">
            <span>Display Name</span>
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEditing}
                className="text-amber-900 hover:text-amber-950 font-semibold underline underline-offset-2 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveName} className="space-y-2 mt-1 font-sans">
              <input
                ref={editInputRef}
                type="text"
                maxLength={30}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter display name"
                disabled={saving}
                className="w-full text-sm px-2.5 py-1.5 rounded bg-white/90 border border-kraft-border/70 text-kraft-dark focus:outline-none focus:ring-2 focus:ring-kraft-dark/40 shadow-inner"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="px-2.5 py-1 text-xs font-semibold rounded text-kraft-dark/70 hover:text-kraft-dark hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !nameInput.trim()}
                  className="px-3 py-1 text-xs font-bold rounded bg-kraft-dark text-tape-cream hover:bg-kraft-dark/90 active:scale-95 transition-all shadow-xs disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm font-sans font-medium text-kraft-dark truncate">
              {displayName}
            </p>
          )}
        </div>

        {/* Stats line: "12 stuck · 8 done" */}
        <div className="my-3 py-2 px-3 bg-black/5 rounded-lg border border-black/10 text-center font-sans text-xs font-semibold text-kraft-dark/80 select-none">
          <span className="font-bold text-kraft-dark">{totalStuck}</span> stuck ·{' '}
          <span className="font-bold text-kraft-dark">{totalDone}</span> done
        </div>

        {/* Friendly reminders toggle */}
        <div className="my-3 py-2 px-3 rounded-lg bg-black/5 border border-kraft-border/50 flex items-center justify-between gap-3 font-sans">
          <div className="min-w-0">
            <span className="block text-xs font-bold text-kraft-dark">
              Friendly reminders
            </span>
            <span className="block text-[11px] text-kraft-dark/65">
              In-app notes for tasks waiting a few days
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={nudgesEnabled}
            aria-label="Toggle friendly reminders"
            onClick={() => onToggleNudges(!nudgesEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft-dark ${
              nudgesEnabled ? 'bg-kraft-dark' : 'bg-black/20'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-tape-cream shadow-sm ring-0 transition duration-200 ease-in-out ${
                nudgesEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Phone notifications section */}
        {vapidPublicKey && (
          <div className="my-3 py-2.5 px-3 rounded-lg bg-black/5 border border-kraft-border/50 font-sans space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-kraft-dark">
                Phone notifications
              </span>
              {isSubscribed && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950 border border-amber-300 select-none">
                  Active
                </span>
              )}
            </div>

            <p className="text-[11px] text-kraft-dark/65 leading-tight">
              Daily phone nudge for your oldest waiting task.
            </p>

            {/* Edge Case 1: Unsupported browser */}
            {!isPushSupported() ? (
              <div className="p-2 rounded bg-black/5 text-[11px] text-kraft-dark/70 italic border border-kraft-border/30">
                Push notifications are not supported by this browser.
              </div>
            ) : isIosNonStandalone() ? (
              /* Edge Case 2: iOS not standalone */
              <div className="p-2 rounded bg-amber-100/60 text-[11px] text-amber-950 border border-amber-200">
                Install TaskTape to your Home Screen first to enable phone notifications.
              </div>
            ) : permissionState === 'denied' ? (
              /* Edge Case 3: Permission blocked */
              <div className="p-2 rounded bg-black/5 text-[11px] text-kraft-dark/70 border border-kraft-border/30">
                Notifications are blocked. Enable them in your browser or device settings to receive reminders.
              </div>
            ) : isSubscribed ? (
              /* Subscribed State: Hour picker + Disable button */
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="remind-hour-select"
                    className="text-xs font-semibold text-kraft-dark min-w-0"
                  >
                    Reminder time:
                  </label>
                  <select
                    id="remind-hour-select"
                    value={remindHour}
                    onChange={(e) => handleUpdateHour(parseInt(e.target.value, 10))}
                    disabled={updatingHour}
                    aria-label="Choose reminder hour"
                    className="text-[16px] md:text-xs py-1.5 px-2.5 rounded bg-white/90 border border-kraft-border/70 text-kraft-dark font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-kraft-dark/40"
                  >
                    {Array.from({ length: 24 }).map((_, h) => {
                      const period = h >= 12 ? 'PM' : 'AM';
                      const displayHour = h % 12 === 0 ? 12 : h % 12;
                      return (
                        <option key={h} value={h}>
                          {`${displayHour}:00 ${period}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleDisablePush}
                  disabled={pushLoading}
                  aria-label="Disable phone notifications"
                  className="w-full min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold text-kraft-dark/70 hover:text-red-700 hover:bg-black/5 active:scale-95 transition-all border border-kraft-border/40 disabled:opacity-40"
                >
                  {pushLoading ? 'Updating...' : 'Disable'}
                </button>
              </div>
            ) : (
              /* Unsubscribed State: Enable button */
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={pushLoading}
                  aria-label="Enable phone notifications"
                  className="w-full min-h-[40px] py-2 px-3 rounded-lg bg-kraft-dark text-tape-cream text-xs font-bold hover:bg-kraft-dark/90 active:scale-95 transition-all shadow-xs disabled:opacity-40"
                >
                  {pushLoading ? 'Setting up...' : 'Enable'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sign Out action */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSignOutClick}
            className="w-full py-2 px-3 text-xs font-bold font-sans uppercase tracking-wider rounded-lg bg-kraft-dark text-tape-cream hover:bg-kraft-dark/90 active:scale-98 transition-all shadow-xs"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
