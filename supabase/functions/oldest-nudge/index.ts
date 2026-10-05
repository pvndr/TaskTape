// @ts-nocheck
declare const Deno: any;

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

/**
 * Constant-time comparison of two Uint8Arrays of equal length.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Constant-time comparison of CRON_SECRET using SHA-256 hashes to guarantee equal byte lengths.
 */
async function verifyCronSecret(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [hashProvided, hashExpected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  return timingSafeEqual(new Uint8Array(hashProvided), new Uint8Array(hashExpected));
}

function getSoftTimePhrase(createdAt: string, ageDays: number, tz: string): string {
  if (ageDays === 2) return 'for a couple of days';
  if (ageDays >= 3 && ageDays <= 6) {
    try {
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(createdAt));
      return `since ${weekday}`;
    } catch {
      return 'for a few days';
    }
  }
  if (ageDays >= 7 && ageDays <= 13) return 'for about a week';
  return 'for a little while';
}

Deno.serve(async (req: Request) => {
  // Reject anything other than POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1. Authenticate with CRON_SECRET using constant-time SHA-256 digest comparison
  const cronHeader = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const isAuthorized = await verifyCronSecret(cronHeader, expectedSecret);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Read environment secrets
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@tasktape.app';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing server configuration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // 3. Initialize service-role Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // 4. Fetch all push subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, remind_hour, tz, last_sent_on');

  if (subError || !subscriptions) {
    return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let checked = 0;
  let sent = 0;
  let skipped = 0;
  let removed = 0;

  const now = new Date();

  for (const sub of subscriptions) {
    checked++;
    const tz = sub.tz || 'UTC';

    let localHour: number;
    let localDateStr: string;

    try {
      const hourFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false
      });
      localHour = parseInt(hourFormatter.format(now), 10) % 24;

      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      localDateStr = dateFormatter.format(now);
    } catch {
      localHour = now.getUTCHours();
      localDateStr = now.toISOString().split('T')[0];
    }

    const targetHour = sub.remind_hour ?? 9;

    // Proceed only if local hour matches remind_hour AND last_sent_on is not today
    if (localHour !== targetHour || sub.last_sent_on === localDateStr) {
      skipped++;
      continue;
    }

    // Find that user's oldest task: done = false AND deleted_at IS NULL
    const { data: oldestTasks, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .eq('user_id', sub.user_id)
      .eq('done', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);

    if (taskError || !oldestTasks || oldestTasks.length === 0) {
      skipped++;
      continue;
    }

    const task = oldestTasks[0];

    // Compute age in local calendar days
    let taskDateStr: string;
    try {
      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      taskDateStr = dateFormatter.format(new Date(task.created_at));
    } catch {
      taskDateStr = new Date(task.created_at).toISOString().split('T')[0];
    }

    const dNow = new Date(localDateStr);
    const dTask = new Date(taskDateStr);
    const ageDays = Math.round((dNow.getTime() - dTask.getTime()) / (1000 * 60 * 60 * 24));

    if (ageDays < 2) {
      skipped++;
      continue;
    }

    // Compose friendly rotating phrasing
    const rawTitle = task.title || '';
    const truncatedTitle = rawTitle.length > 40 ? rawTitle.slice(0, 40) + '…' : rawTitle;
    const timePhrase = getSoftTimePhrase(task.created_at, ageDays, tz);

    const charCodeSum = (task.id || '').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    const phraseIndex = (charCodeSum + ageDays) % 4;

    const phrasings = [
      `"${truncatedTitle}" has been patiently waiting on your board ${timePhrase}.`,
      `Whenever you have a moment, "${truncatedTitle}" has been taped here ${timePhrase}.`,
      `Still thinking about "${truncatedTitle}"? It has been on your tape ${timePhrase}.`,
      `Here is a gentle note: "${truncatedTitle}" has been quietly waiting ${timePhrase}.`
    ];

    const body = phrasings[phraseIndex];

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    const payload = JSON.stringify({
      title: 'TaskTape',
      body,
      url: '/'
    });

    try {
      await webpush.sendNotification(pushSubscription, payload);

      // Update last_sent_on to the local date
      await supabase
        .from('push_subscriptions')
        .update({ last_sent_on: localDateStr })
        .eq('id', sub.id);

      sent++;
    } catch (err) {
      const errorObj = err as any;
      const statusCode = errorObj?.statusCode || errorObj?.status;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired or unsubscribed: remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id);
        removed++;
      } else {
        skipped++;
      }
    }
  }

  // Return counts only (never log endpoints, keys, or task titles)
  return new Response(
    JSON.stringify({ checked, sent, skipped, removed }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
});
