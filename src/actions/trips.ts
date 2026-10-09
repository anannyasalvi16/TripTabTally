'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { tripSchema, type TripInput } from '@/lib/schemas/trip';

export type TripActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  tripId?: string;
};

export async function createTripAction(
  prevState: TripActionResult | null,
  formData: FormData
): Promise<TripActionResult> {
  const rawData: Record<string, string> = {
    name: String(formData.get('name') || ''),
    destination: String(formData.get('destination') || ''),
    startDate: String(formData.get('startDate') || ''),
    endDate: String(formData.get('endDate') || ''),
    budgetRupees: String(formData.get('budgetRupees') || ''),
    displayName: String(formData.get('displayName') || ''),
  };

  const parsed = tripSchema.safeParse(rawData);
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

  const { name, destination, startDate, endDate, budgetRupees, displayName } = parsed.data;

  let budgetPaise: number | null = null;
  if (budgetRupees) {
    const cleanRupees = Number(budgetRupees.replace(/,/g, ''));
    if (!isNaN(cleanRupees) && cleanRupees > 0) {
      budgetPaise = Math.round(cleanRupees * 100);
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'You must be signed in to create a trip.' };
  }

  // Call the atomic create_trip RPC
  const { data: tripId, error } = await supabase.rpc('create_trip', {
    p_name: name,
    p_destination: destination || null,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_currency: 'INR',
    p_budget_paise: budgetPaise,
    p_display_name: displayName,
  });

  if (error || !tripId) {
    return { ok: false, message: error?.message || 'Could not create trip.' };
  }

  // Generate initial 14-day invite link
  const token = crypto.randomBytes(16).toString('hex');
  await supabase.from('invites').insert({
    token,
    trip_id: tripId,
    created_by: user.id,
  });

  revalidatePath('/trips');
  redirect(`/trips/${tripId}`);
}

export async function archiveTripAction(tripId: string, archive: boolean): Promise<TripActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'Authentication required.' };
  }

  const { error } = await supabase
    .from('trips')
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq('id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  return {
    ok: true,
    message: archive ? 'Trip archived. It is now read-only.' : 'Trip restored to active status.',
  };
}
