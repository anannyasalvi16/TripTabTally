'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { placeholderSchema, joinTripSchema, familySchema } from '@/lib/schemas/member';

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
  const rawEmail = String(formData.get('email') || '').trim();
  const rawPhone = String(formData.get('phone') || '').trim();
  const rawFamilyId = String(formData.get('familyId') || '').trim();

  const parsed = placeholderSchema.safeParse({
    displayName,
    email: rawEmail || undefined,
    phone: rawPhone || undefined,
    familyId: rawFamilyId || null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message || 'Invalid member data.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('trip_members').insert({
    trip_id: tripId,
    display_name: parsed.data.displayName,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    family_id: parsed.data.familyId || null,
    role: 'member',
    user_id: null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: `Added member "${parsed.data.displayName}".`,
  };
}

export const addManualMemberAction = addPlaceholderAction;

export async function createFamilyAction(
  tripId: string,
  prevState: MemberActionResult | null,
  formData: FormData
): Promise<MemberActionResult> {
  const name = String(formData.get('name') || '');
  const parsed = familySchema.safeParse({ name });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.errors[0]?.message || 'Invalid family name.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('trip_families').insert({
    trip_id: tripId,
    name: parsed.data.name,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'A family with this name already exists in this trip.' };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: `Created "${parsed.data.name}".`,
  };
}

export async function updateMemberFamilyAction(
  tripId: string,
  memberId: string,
  familyId: string | null
): Promise<MemberActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('trip_members')
    .update({ family_id: familyId })
    .eq('id', memberId)
    .eq('trip_id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: 'Updated family assignment.',
  };
}

export async function deleteFamilyAction(
  tripId: string,
  familyId: string,
  familyName: string
): Promise<MemberActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('trip_families')
    .delete()
    .eq('id', familyId)
    .eq('trip_id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: `Removed "${familyName}". Members are now marked as solo.`,
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

export async function regenerateInviteAction(
  tripId: string,
  expiryDays: number | null = 14
): Promise<MemberActionResult> {
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
  const expiresAt =
    expiryDays === null
      ? null
      : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('invites').insert({
    token,
    trip_id: tripId,
    created_by: user.id,
    expires_at: expiresAt,
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

export async function revokeInviteAction(tripId: string): Promise<MemberActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Authentication required.' };
  }

  // Verify admin role
  const { data: currentMember } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (currentMember?.role !== 'admin') {
    return { ok: false, message: 'Only admins can revoke invite links.' };
  }

  const { error } = await supabase
    .from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .is('revoked_at', null);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}/people`);
  return {
    ok: true,
    message: 'Invite link revoked. Nobody can join with the previous link.',
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
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not signed in, create an anonymous guest session
  if (!user) {
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      // If anonymous auth fails or is disabled in project, surface message
      return {
        ok: false,
        message: 'Could not create guest session. Please try signing in.',
      };
    }
    user = anonData.user;
  }

  if (user && parsed.data.displayName) {
    // Update profile display name for the newly authenticated/anonymous session
    await supabase
      .from('profiles')
      .update({ display_name: parsed.data.displayName.trim() })
      .eq('id', user.id);
  }

  const { data, error } = await supabase.rpc('join_trip', {
    p_token: parsed.data.token,
    p_claim_member_id: parsed.data.claimMemberId || null,
    p_display_name: parsed.data.displayName || null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; trip_id?: string; error?: string };
  if (result && !result.ok && result.error) {
    return { ok: false, message: result.error };
  }

  if (result?.trip_id) {
    revalidatePath(`/trips/${result.trip_id}`);
    redirect(`/trips/${result.trip_id}`);
  }

  return { ok: true };
}
