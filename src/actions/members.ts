'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { placeholderSchema, joinTripSchema } from '@/lib/schemas/member';

export type MemberActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  token?: string;
  tripId?: string;
};

export async function addPlaceholderAction(
  tripId: string,
  prevState: MemberActionResult | null,
  formData: FormData
): Promise<MemberActionResult> {
  const displayName = String(formData.get('displayName') || '');
  const parsed = placeholderSchema.safeParse({ displayName });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message || 'Invalid display name.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('trip_members').insert({
    trip_id: tripId,
    display_name: parsed.data.displayName,
    role: 'member',
    user_id: null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: `Added placeholder member "${parsed.data.displayName}".`,
  };
}

export async function toggleMemberRoleAction(
  tripId: string,
  memberId: string,
  newRole: 'admin' | 'member',
  memberName: string
): Promise<MemberActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('trip_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('trip_id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: `Changed ${memberName} to ${newRole}.`,
  };
}

export async function markMemberLeftAction(
  tripId: string,
  memberId: string,
  memberName: string
): Promise<MemberActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('trip_members')
    .update({ left_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('trip_id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: `Marked ${memberName} as left. History preserved.`,
  };
}

export async function regenerateInviteAction(tripId: string): Promise<MemberActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Authentication required.' };
  }

  // Revoke existing invites
  await supabase
    .from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .is('revoked_at', null);

  const token = crypto.randomBytes(16).toString('hex');
  const { error } = await supabase.from('invites').insert({
    token,
    trip_id: tripId,
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    token,
    message: 'Generated a new invite link. Previous links are now inactive.',
  };
}

export async function joinTripAction(
  prevState: MemberActionResult | null,
  formData: FormData
): Promise<MemberActionResult> {
  const token = String(formData.get('token') || '');
  const claimMemberId = String(formData.get('claimMemberId') || '') || undefined;
  const displayName = String(formData.get('displayName') || '') || undefined;

  const parsed = joinTripSchema.safeParse({ token, claimMemberId, displayName });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message || 'Invalid join data.',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_trip', {
    p_token: parsed.data.token,
    p_claim_member_id: parsed.data.claimMemberId || null,
    p_display_name: parsed.data.displayName || null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; trip_id?: string };
  if (result?.trip_id) {
    revalidatePath(`/trips/${result.trip_id}`);
    redirect(`/trips/${result.trip_id}`);
  }

  return { ok: true };
}
