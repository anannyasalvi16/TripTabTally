'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { settlementSchema } from '@/lib/schemas/settlement';
import { parseRupeesToPaise, formatPaise } from '@/lib/money';

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function recordSettlementAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'You must be signed in to record a settlement.' };
  }

  const raw = {
    tripId: formData.get('tripId') as string,
    fromMember: formData.get('fromMember') as string,
    toMember: formData.get('toMember') as string,
    amountRupees: (formData.get('amountRupees') as string)?.trim() || '',
    paidOn: (formData.get('paidOn') as string) || new Date().toISOString().split('T')[0],
    note: (formData.get('note') as string)?.trim() || '',
  };

  const parsed = settlementSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return { ok: false, fieldErrors, message: 'Please correct the errors below.' };
  }

  const { tripId, fromMember, toMember, amountRupees, paidOn, note } = parsed.data;

  // Find caller's member row
  const { data: callerMember } = await supabase
    .from('trip_members')
    .select('id, role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!callerMember) {
    return { ok: false, message: 'You are not a member of this trip.' };
  }

  // Caller must be fromMember, toMember, or admin
  const isParty = callerMember.id === fromMember || callerMember.id === toMember;
  const isAdmin = callerMember.role === 'admin';
  if (!isParty && !isAdmin) {
    return {
      ok: false,
      message: 'Only the payer, receiver, or a trip admin can record this settlement.',
    };
  }

  const parseResult = parseRupeesToPaise(amountRupees);
  if (!parseResult.ok) {
    return { ok: false, fieldErrors: { amountRupees: parseResult.error } };
  }
  const amountPaise = parseResult.data;

  // Fetch names for feedback
  const { data: partyMembers } = await supabase
    .from('trip_members')
    .select('id, display_name')
    .in('id', [fromMember, toMember]);

  const payerName =
    partyMembers?.find((m) => m.id === fromMember)?.display_name || 'Member';
  const receiverName =
    partyMembers?.find((m) => m.id === toMember)?.display_name || 'Member';

  const { error } = await supabase.from('settlements').insert({
    trip_id: tripId,
    from_member: fromMember,
    to_member: toMember,
    amount_paise: amountPaise,
    paid_on: paidOn,
    note: note || null,
    created_by: callerMember.id,
  });

  if (error) {
    return { ok: false, message: 'Could not record settlement. Please try again.' };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/settle`);

  return {
    ok: true,
    message: `Recorded payment of ${formatPaise(amountPaise)} from ${payerName} to ${receiverName}.`,
  };
}

export async function voidSettlementAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'You must be signed in to void a settlement.' };
  }

  const settlementId = formData.get('settlementId') as string;
  const tripId = formData.get('tripId') as string;

  if (!settlementId || !tripId) {
    return { ok: false, message: 'Missing settlement identifier.' };
  }

  // Get settlement details
  const { data: settlement } = await supabase
    .from('settlements')
    .select('id, amount_paise, created_by, from_member, to_member')
    .eq('id', settlementId)
    .single();

  if (!settlement) {
    return { ok: false, message: 'Settlement record not found.' };
  }

  // Check caller role or creator
  const { data: callerMember } = await supabase
    .from('trip_members')
    .select('id, role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!callerMember) {
    return { ok: false, message: 'You are not a member of this trip.' };
  }

  const isCreator = callerMember.id === settlement.created_by;
  const isAdmin = callerMember.role === 'admin';
  if (!isCreator && !isAdmin) {
    return {
      ok: false,
      message: 'Only the person who recorded this settlement or an admin can void it.',
    };
  }

  const { error } = await supabase
    .from('settlements')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', settlementId);

  if (error) {
    return { ok: false, message: 'Could not void settlement. Please try again.' };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/settle`);

  return {
    ok: true,
    message: `Voided settlement of ${formatPaise(settlement.amount_paise)}. Balances updated.`,
  };
}
