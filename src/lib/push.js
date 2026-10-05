import { supabase } from './supabase';

/**
 * Converts a base64url VAPID public key string to a Uint8Array required by pushManager.subscribe.
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if Web Push notifications are supported in this browser.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Checks if the user is on iOS Safari outside of standalone mode.
 * Web Push on iOS requires PWA installation to the Home Screen.
 */
export function isIosNonStandalone() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
  return isIOS && !isStandalone;
}

/**
 * Safely awaits navigator.serviceWorker.ready with an 8-second timeout to prevent hanging.
 */
export async function getServiceWorkerReady(timeoutMs = 8000) {
  if (!('serviceWorker' in navigator)) return null;

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Service worker took too long to become ready. Please try again.')),
        timeoutMs
      )
    )
  ]);
}

/**
 * Gets existing push subscription from active service worker registration.
 */
export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await getServiceWorkerReady(8000);
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('Could not check current push subscription:', err);
    return null;
  }
}

/**
 * Best-effort unsubscribe: unsubscribes the current device and deletes its row in push_subscriptions.
 * Catches all errors so this operation never blocks sign-out or caller flow.
 */
export async function unsubscribePushDevice(isDemo = false) {
  if (isDemo || !isPushSupported()) return;

  try {
    const reg = await getServiceWorkerReady(4000).catch(() => null);
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (!sub) return;

    const endpoint = sub.endpoint;
    // 1. Unsubscribe locally
    await sub.unsubscribe().catch(() => {});

    // 2. Delete row from push_subscriptions
    if (endpoint && supabase) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .catch(() => {});
    }
  } catch (err) {
    console.warn('Best-effort push unsubscribe failed:', err);
  }
}
