'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name must be at least 1 character.')
    .max(60, 'Display name cannot exceed 60 characters.'),
  upiId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true;
        return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(val);
      },
      { message: 'Please enter a valid UPI ID (e.g. name@okaxis).' }
    ),
});

export type ProfileActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function updateProfileAction(
  _prevState: ProfileActionResult | null,
  formData: FormData
): Promise<ProfileActionResult> {
  const displayName = String(formData.get('displayName') || '');
  const upiId = String(formData.get('upiId') || '');

  const parsed = profileSchema.safeParse({ displayName, upiId });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.errors.forEach((err) => {
      const field = err.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = err.message;
      }
    });
    return { ok: false, fieldErrors, message: 'Please correct the highlighted fields.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Authentication required.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.displayName,
      upi_id: parsed.data.upiId || null,
    })
    .eq('id', user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/profile');
  return { ok: true, message: 'Profile updated.' };
}

export async function deleteAccountAction(
  _prevState: ProfileActionResult | null,
  formData: FormData
): Promise<ProfileActionResult> {
  const confirmed = formData.get('confirm') === 'yes';
  if (!confirmed) {
    return { ok: false, message: 'Please confirm account deletion before proceeding.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Authentication required.' };
  }

  // 1. Anonymize member names on all trips where this user participated
  const { error: memberError } = await supabase
    .from('trip_members')
    .update({
      display_name: 'Former member',
      user_id: null,
    })
    .eq('user_id', user.id);

  if (memberError) {
    return { ok: false, message: 'Could not anonymise trip member history. Please try again.' };
  }

  // 2. Delete user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', user.id);

  if (profileError) {
    return { ok: false, message: 'Could not delete profile record. Please try again.' };
  }

  // 3. Sign out session
  await supabase.auth.signOut();

  redirect('/login');
}
