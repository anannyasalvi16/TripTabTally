'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseRupeesToPaise, formatPaise, splitEqual, splitExact, splitPercent, splitShares, splitFamily } from '@/lib/money';
import { expenseSchema, validateExpenseDate, parseDateInput, type SplitType, type ExpenseCategory } from '@/lib/schemas/expense';

export type ExpenseActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  conflict?: boolean;
  currentVersion?: number;
  expenseId?: string;
};

export async function saveExpenseAction(
  prevState: ExpenseActionResult | null,
  formData: FormData
): Promise<ExpenseActionResult> {
  const expenseId = String(formData.get('id') || '') || undefined;
  const tripId = String(formData.get('tripId') || '');
  const title = String(formData.get('title') || '');
  const amountRupees = String(formData.get('amountRupees') || '');
  const category = String(formData.get('category') || '') as ExpenseCategory;
  const paidBy = String(formData.get('paidBy') || '');
  const rawSpentOn = String(formData.get('spentOn') || '');
  const rawSpentOnDisplay = String(formData.get('spentOnDisplay') || '');
  const spentOn = parseDateInput(rawSpentOn) || parseDateInput(rawSpentOnDisplay) || rawSpentOn || rawSpentOnDisplay;
  const formTripStartDate = String(formData.get('tripStartDate') || '') || undefined;
  const formTripEndDate = String(formData.get('tripEndDate') || '') || undefined;
  const note = String(formData.get('note') || '');
  const splitType = String(formData.get('splitType') || 'equal') as SplitType;
  const rawSplitInput = String(formData.get('splitInput') || '{}');
  const expectedVersionStr = String(formData.get('version') || '');
  const expectedVersion = expectedVersionStr ? parseInt(expectedVersionStr, 10) : undefined;

  let splitInput: Record<string, any> = {};
  try {
    splitInput = JSON.parse(rawSplitInput);
  } catch {
    return { ok: false, message: 'Invalid split input format.' };
  }

  // Parse and validate money amount
  const parsedMoney = parseRupeesToPaise(amountRupees);
  if (!parsedMoney.ok) {
    return {
      ok: false,
      fieldErrors: { amountRupees: parsedMoney.error },
      message: parsedMoney.error,
    };
  }

  const amountPaise = parsedMoney.data;
  if (amountPaise <= 0) {
    return {
      ok: false,
      fieldErrors: { amountRupees: 'Amount must be greater than zero.' },
      message: 'Amount must be greater than zero.',
    };
  }

  const supabase = await createClient();

  // Validate expense date against trip start and end date
  let effectiveStartDate = formTripStartDate;
  let effectiveEndDate = formTripEndDate;

  const { data: tripData } = await supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', tripId)
    .single();

  if (tripData) {
    effectiveStartDate = tripData.start_date ?? undefined;
    effectiveEndDate = tripData.end_date ?? undefined;
  }

  const dateValidation = validateExpenseDate(spentOn, effectiveStartDate, effectiveEndDate);
  if (!dateValidation.valid) {
    return {
      ok: false,
      fieldErrors: { spentOn: dateValidation.error || 'Invalid date.' },
      message: dateValidation.error || 'Invalid date.',
    };
  }

  // Calculate splits using pure money engine functions
  let calculatedSplits: Record<string, number> = {};
  if (splitType === 'equal') {
    const memberIds = Array.isArray(splitInput.memberIds) ? splitInput.memberIds : [];
    if (memberIds.length === 0) {
      return { ok: false, message: 'Select at least one member to split with.' };
    }
    calculatedSplits = splitEqual(amountPaise, memberIds, expenseId || title);
  } else if (splitType === 'exact') {
    const exactPaiseMap: Record<string, number> = {};
    for (const [mid, strVal] of Object.entries(splitInput.amounts || {})) {
      const parsed = parseRupeesToPaise(String(strVal || '0'));
      exactPaiseMap[mid] = parsed.ok ? parsed.data : 0;
    }
    const res = splitExact(amountPaise, exactPaiseMap);
    if (!res.ok) {
      return { ok: false, message: res.error };
    }
    calculatedSplits = res.data;
  } else if (splitType === 'percent') {
    const pctMap: Record<string, number> = {};
    for (const [mid, strVal] of Object.entries(splitInput.percentages || {})) {
      pctMap[mid] = parseFloat(String(strVal || '0'));
    }
    const res = splitPercent(amountPaise, pctMap);
    if (!res.ok) {
      return { ok: false, message: res.error };
    }
    calculatedSplits = res.data;
  } else if (splitType === 'shares') {
    const sharesMap: Record<string, number> = {};
    for (const [mid, strVal] of Object.entries(splitInput.shares || {})) {
      sharesMap[mid] = parseFloat(String(strVal || '1'));
    }
    const res = splitShares(amountPaise, sharesMap);
    if (!res.ok) {
      return { ok: false, message: res.error };
    }
    calculatedSplits = res.data;
  } else if (splitType === 'family') {
    const { data: tripMembers } = await supabase
      .from('trip_members')
      .select('id, family_id')
      .eq('trip_id', tripId)
      .is('left_at', null);

    const membersList = (tripMembers || []).map((m) => ({
      id: m.id,
      familyId: m.family_id,
    }));

    const memberIds = Array.isArray(splitInput.memberIds) ? splitInput.memberIds : membersList.map((m) => m.id);
    const res = splitFamily(amountPaise, membersList, memberIds, expenseId || title);
    if (!res.ok) {
      return { ok: false, message: res.error };
    }
    calculatedSplits = res.data.memberShares;
  }

  // Prepare database split payload
  const splitsPayload = Object.entries(calculatedSplits)
    .filter(([, share]) => share >= 0)
    .map(([member_id, share_paise]) => ({
      member_id,
      share_paise,
    }));

  if (splitsPayload.length === 0) {
    return { ok: false, message: 'At least one member must be included in the split.' };
  }

  // Call atomic save_expense database function
  const { data: rpcData, error } = await supabase.rpc('save_expense', {
    p_expense_id: expenseId || null,
    p_trip_id: tripId,
    p_title: title.trim(),
    p_amount_paise: amountPaise,
    p_category: category,
    p_paid_by: paidBy,
    p_spent_on: dateValidation.isoDate || spentOn,
    p_note: note.trim() || null,
    p_split_type: splitType,
    p_split_input: splitInput,
    p_splits: splitsPayload,
    p_expected_version: expectedVersion || null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = rpcData as { ok: boolean; conflict?: boolean; current_version?: number; expense_id?: string };

  if (result.conflict) {
    return {
      ok: false,
      conflict: true,
      currentVersion: result.current_version,
      message: 'Someone else modified this expense. Review latest changes before saving.',
    };
  }

  // Fetch payer display name for truthful specific message
  const { data: payerMember } = await supabase
    .from('trip_members')
    .select('display_name')
    .eq('id', paidBy)
    .single();

  const payerName = payerMember?.display_name || 'Member';
  const splitsCount = splitsPayload.length;
  const actionWord = expenseId ? 'Updated' : 'Added';
  const formattedAmount = formatPaise(amountPaise);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/budget`);
  revalidatePath(`/trips/${tripId}/settle`);

  return {
    ok: true,
    expenseId: result.expense_id,
    message: `${actionWord} "${title.trim()}", ${formattedAmount} split between ${splitsCount}. ${payerName} paid.`,
  };
}

export async function deleteExpenseAction(
  tripId: string,
  expenseId: string,
  title: string
): Promise<ExpenseActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('trip_id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/budget`);
  revalidatePath(`/trips/${tripId}/settle`);

  return {
    ok: true,
    expenseId,
    message: `Removed "${title}". Totals updated.`,
  };
}

export async function restoreExpenseAction(
  tripId: string,
  expenseId: string,
  title: string
): Promise<ExpenseActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: null })
    .eq('id', expenseId)
    .eq('trip_id', tripId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/budget`);
  revalidatePath(`/trips/${tripId}/settle`);

  return {
    ok: true,
    message: `Restored "${title}".`,
  };
}
