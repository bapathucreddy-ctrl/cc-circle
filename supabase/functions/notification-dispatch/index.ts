import { adminClient, json } from '../_shared/payments.ts';
import { firebaseAccessToken, firebaseAccount, firebaseMessage, firebaseResult } from '../_shared/firebase.ts';
import { apnsAccount, apnsAuthorization, apnsRequest, apnsResult, type ApnsEnvironment } from '../_shared/apns.ts';

// Private scheduled endpoint. It never accepts a caller-supplied recipient or payload.
Deno.serve(async req => {
  const expected = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  const supplied = req.headers.get('x-circle-dispatch');
  if (req.method !== 'POST' || !expected || !supplied) return json({ error: 'Unauthorized' }, 401);
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(expected), digest(supplied)]);
  if (a.reduce((different, byte, i) => different | (byte ^ b[i]), 0) !== 0) return json({ error: 'Unauthorized' }, 401);
  const admin = adminClient();
  const reminders = await admin.rpc('queue_booking_reminders');
  if (reminders.error) return json({ error: 'Unable to queue reminders' }, 500);
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  const appleKeyId = Deno.env.get('APNS_KEY_ID'), appleTeamId = Deno.env.get('APNS_TEAM_ID'), appleKey = Deno.env.get('APNS_PRIVATE_KEY');
  const providers = [...(raw ? ['fcm'] : []), ...(appleKeyId && appleTeamId && appleKey ? ['apns'] : [])];
  if (!providers.length) return json({ inbox: true, push: 'awaiting_push_configuration' });
  try {
    const { data, error } = await admin.rpc('claim_notification_deliveries_for_providers', { p_providers: providers });
    if (error) throw new Error('Unable to claim notifications');
    let sent = 0; let retried = 0;
    const jobs = data as { id: string; attempt: number; token: string; notification_id: string; title: string; variant: string; provider: string; environment: ApnsEnvironment }[];
    // Five at a time keeps FCM/Edge limits bounded. Retry leases survive termination.
    for (let at = 0; at < jobs.length; at += 5) {
      await Promise.all(jobs.slice(at, at + 5).map(async job => {
        let result: 'sent' | 'invalid' | 'retry' | 'failed' = 'retry';
        try {
          // Suppress notifications purged by chat closure, read on another device, or deleted events.
          const current = await admin.rpc('notification_delivery_current', { p_id: job.id, p_attempt: job.attempt });
          if (current.error) throw new Error('Unable to recheck notification');
          if (!current.data) result = 'failed';
          else {
            if (job.provider === 'apns' && appleKeyId && appleTeamId && appleKey) {
              const authorization = await apnsAuthorization(apnsAccount(appleKeyId, appleTeamId, appleKey));
              const request = apnsRequest(job.token, job.environment, job.variant, job.notification_id, job.title, authorization);
              const response = await fetch(request.url, request.options);
              const body = response.status === 200 ? {} : await response.json();
              result = apnsResult(response.status, body.reason);
            } else if (job.provider === 'fcm' && raw) {
              const account = firebaseAccount(raw); const token = await firebaseAccessToken(account);
              const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(firebaseMessage(job.token, job.notification_id, job.title)), signal: AbortSignal.timeout(10000) });
              const body = await response.json(); result = firebaseResult(response.status, body);
            }
          }
        } catch { result = 'retry'; }
        const finished = await admin.rpc('finish_notification_delivery', { p_id: job.id, p_attempt: job.attempt, p_result: result });
        if (finished.error) throw new Error('Unable to record notification delivery');
        if (result === 'sent') sent++; else if (result === 'retry') retried++;
      }));
    }
    return json({ sent, retried });
  } catch { return json({ error: 'Notification delivery unavailable. Queued updates will retry.' }, 503); }
});
