'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateBudgetSchema, updateCategoryLimitSchema } from '@/lib/schemas/budget';
import { parseRupeesToPaise, formatPaise } from '@/lib/money';

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function updateTripBudgetAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'You must be signed in to change the budget.' };
  }

  const raw = {
    tripId: formData.get('tripId') as string,
    budgetRupees: (formData.get('budgetRupees') as string)?.trim() || '',
  };

  const parsed = updateBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return { ok: false, fieldErrors, message: 'Please correct the error below.' };
  }

  const { tripId, budgetRupees } = parsed.data;

  // Check admin
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return { ok: false, message: 'Only an admin can change the trip budget.' };
  }

  let budgetPaise: number | null = null;
  if (budgetRupees) {
    const parseResult = parseRupeesToPaise(budgetRupees);
    if (!parseResult.ok) {
      return { ok: false, fieldErrors: { budgetRupees: parseResult.error } };
    }
    budgetPaise = parseResult.data;
  }

  const { error } = await supabase
    .from('trips')
    .update({ budget_paise: budgetPaise })
    .eq('id', tripId);

  if (error) {
    return { ok: false, message: 'Could not update trip budget. Please try again.' };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/budget`);

  return {
    ok: true,
    message: budgetPaise
      ? `Updated total trip budget to ${formatPaise(budgetPaise)}.`
      : 'Removed total trip budget.',
  };
}

export async function updateCategoryLimitAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: 'You must be signed in to set category limits.' };
  }

  const raw = {
    tripId: formData.get('tripId') as string,
    category: formData.get('category') as string,
    limitRupees: (formData.get('limitRupees') as string)?.trim() || '',
  };

  const parsed = updateCategoryLimitSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return { ok: false, fieldErrors, message: 'Please correct the error below.' };
  }

  const { tripId, category, limitRupees } = parsed.data;

  // Check admin
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return { ok: false, message: 'Only an admin can set category limits.' };
  }

  if (!limitRupees) {
    // Delete limit
    const { error } = await supabase
      .from('category_limits')
      .delete()
      .eq('trip_id', tripId)
      .eq('category', category);

    if (error) {
      return { ok: false, message: `Could not clear limit for ${category}.` };
    }

    revalidatePath(`/trips/${tripId}/budget`);
    return {
      ok: true,
      message: `Cleared spending limit for ${category}.`,
    };
  }

  const parseResult = parseRupeesToPaise(limitRupees);
  if (!parseResult.ok) {
    return { ok: false, fieldErrors: { limitRupees: parseResult.error } };
  }

  const limitPaise = parseResult.data;

  const { error } = await supabase.from('category_limits').upsert(
    {
      trip_id: tripId,
      category,
      limit_paise: limitPaise,
    },
    { onConflict: 'trip_id,category' }
  );

  if (error) {
    return { ok: false, message: `Could not save limit for ${category}.` };
  }

  revalidatePath(`/trips/${tripId}/budget`);
  return {
    ok: true,
    message: `Set ${category} spending limit to ${formatPaise(limitPaise)}.`,
  };
}
