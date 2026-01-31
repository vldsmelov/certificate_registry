import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';
import { Flags } from '@/lib/config';
import { ConsoleEmailProvider, ResendProvider } from '@/lib/email';

export async function POST(_request: NextRequest) {
  const session = getSession();
  requirePermission(session, 'notifications:dispatch');

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const provider = Flags.enableEmails && process.env.RESEND_API_KEY
    ? new ResendProvider(process.env.RESEND_API_KEY)
    : new ConsoleEmailProvider();

  let processed = 0;

  for (const item of data ?? []) {
    try {
      await provider.send({
        to: item.payload_json.to ?? 'ops@example.com',
        subject: item.payload_json.subject ?? `Notification: ${item.event_type}`,
        html: item.payload_json.html ?? '<p>Notification</p>'
      });

      await supabase
        .from('notification_outbox')
        .update({ status: 'sent', attempts_count: item.attempts_count + 1 })
        .eq('id', item.id);

      processed += 1;
    } catch (sendError) {
      await supabase
        .from('notification_outbox')
        .update({
          status: 'failed',
          attempts_count: item.attempts_count + 1,
          last_error: sendError instanceof Error ? sendError.message : 'Unknown error'
        })
        .eq('id', item.id);
    }
  }

  return Response.json({ processed });
}
