'use server';

import { revalidatePath } from 'next/cache';
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
  prevState: ProfileActionResult | null,
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
