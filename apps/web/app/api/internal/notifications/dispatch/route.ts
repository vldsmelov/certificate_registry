import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';
import { Flags } from '@/lib/config';
import { ConsoleEmailProvider, ResendProvider } from '@/lib/email';

export async function POST(_request: NextRequest) {
  const session = getSession();
  requirePermission(session, 'notifications:dispatch');

  const { rows } = await query<{
    id: string;
    event_type: string;
    payload_json: { to?: string; subject?: string; html?: string };
    attempts_count: number;
  }>(
    `
    select id, event_type, payload_json, attempts_count
    from notification_outbox
    where status = 'pending'
    order by created_at asc
    limit 10
    `
  );

  const provider = Flags.enableEmails && process.env.RESEND_API_KEY
    ? new ResendProvider(process.env.RESEND_API_KEY)
    : new ConsoleEmailProvider();

  let processed = 0;

  for (const item of rows ?? []) {
    try {
      await provider.send({
        to: item.payload_json.to ?? 'ops@example.com',
        subject: item.payload_json.subject ?? `Notification: ${item.event_type}`,
        html: item.payload_json.html ?? '<p>Notification</p>'
      });

      await query(
        `
        update notification_outbox
        set status = 'sent', attempts_count = $1
        where id = $2
        `,
        [item.attempts_count + 1, item.id]
      );

      processed += 1;
    } catch (sendError) {
      await query(
        `
        update notification_outbox
        set status = 'failed',
            attempts_count = $1,
            last_error = $2
        where id = $3
        `,
        [
          item.attempts_count + 1,
          sendError instanceof Error ? sendError.message : 'Unknown error',
          item.id
        ]
      );
    }
  }

  return Response.json({ processed });
}
