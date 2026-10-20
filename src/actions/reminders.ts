'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canSendReminder } from '@/lib/reminders';

export interface ReminderActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

/**
 * Records a due reminder in the database and enforces the 1-per-day rate limit per debtor.
 */
export async function recordDueReminderAction(
  tripId: string,
  fromMemberId: string,
  toMemberId: string,
  amountPaise: number,
  channel: 'whatsapp' | 'sms' | 'copy' | 'share'
): Promise<ReminderActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'You must be signed in to send reminders.' };
  }

  // 1. Verify user membership in trip
  const { data: currentMember } = await supabase
    .from('trip_members')
    .select('id, role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single();

  if (!currentMember) {
    return { ok: false, error: 'You are not an active member of this trip.' };
  }

  // 2. Server-side Rate Limit check (past 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentReminders } = await supabase
    .from('due_reminders')
    .select('reminded_at')
    .eq('trip_id', tripId)
    .eq('from_member', fromMemberId)
    .gte('reminded_at', twentyFourHoursAgo)
    .order('reminded_at', { ascending: false })
    .limit(1);

  if (recentReminders && recentReminders.length > 0) {
    const check = canSendReminder(recentReminders[0]?.reminded_at);
    if (!check.allowed) {
      return {
        ok: false,
        error: `A reminder was already sent recently. Please wait ${check.waitHoursRemaining || 24}h before reminding again.`,
      };
    }
  }

  // 3. Record reminder
  const { error: insertError } = await supabase.from('due_reminders').insert({
    trip_id: tripId,
    from_member: fromMemberId,
    to_member: toMemberId,
    amount_paise: amountPaise,
    channel,
    created_by: user.id,
    reminded_at: new Date().toISOString(),
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath(`/trips/${tripId}/settle`);
  return { ok: true, message: 'Reminder logged successfully.' };
}
