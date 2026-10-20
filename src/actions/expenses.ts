'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseRupeesToPaise, formatPaise, splitEqual, splitExact, splitPercent, splitShares, splitFamily } from '@/lib/money';
import { expenseSchema, validateExpenseDate, parseDateInput, type SplitType, type ExpenseCategory } from '@/lib/schemas/expense';
import { generateRecurringDates } from '@/lib/recurring';

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

  const isRecurring = formData.get('isRecurring') === 'true';
  const repeatFrequency = String(formData.get('repeatFrequency') || 'daily') as 'daily' | 'weekly' | 'custom';
  const repeatIntervalDays = parseInt(String(formData.get('repeatIntervalDays') || '1'), 10) || 1;
  const repeatEndDate = String(formData.get('repeatEndDate') || '');
  const recurrenceScope = String(formData.get('recurrenceScope') || 'single') as 'single' | 'future' | 'all';

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

  // 1. Create recurring series if isRecurring is enabled for new expense
  if (!expenseId && isRecurring) {
    const rawRepeatEndDate = parseDateInput(repeatEndDate) || repeatEndDate;
    const intervalDays =
      repeatFrequency === 'daily' ? 1 : repeatFrequency === 'weekly' ? 7 : repeatIntervalDays;

    const { dates, error: dateGenError } = generateRecurringDates({
      startDate: dateValidation.isoDate || spentOn,
      endDate: rawRepeatEndDate,
      tripStartDate: effectiveStartDate,
      tripEndDate: effectiveEndDate,
      frequency: repeatFrequency,
      intervalDays,
    });

    if (dateGenError) {
      return { ok: false, message: dateGenError };
    }

    if (dates.length > 1) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: creatorMember } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', user?.id || '')
        .is('left_at', null)
        .single();

      const { data: newRule, error: ruleErr } = await supabase
        .from('recurring_rules')
        .insert({
          trip_id: tripId,
          frequency: repeatFrequency,
          interval_days: intervalDays,
          start_date: dates[0],
          end_date: dates[dates.length - 1],
          created_by: creatorMember?.id || null,
        })
        .select('id')
        .single();

      if (ruleErr) {
        return { ok: false, message: ruleErr.message };
      }

      let firstExpenseId: string | undefined;
      for (let i = 0; i < dates.length; i++) {
        const occDate = dates[i];
        const { data: rpcData, error: occError } = await supabase.rpc('save_expense', {
          p_expense_id: null,
          p_trip_id: tripId,
          p_title: title.trim(),
          p_amount_paise: amountPaise,
          p_category: category,
          p_paid_by: paidBy,
          p_spent_on: occDate,
          p_note: note.trim() || null,
          p_split_type: splitType,
          p_split_input: splitInput,
          p_splits: splitsPayload,
          p_expected_version: null,
        });

        if (occError) {
          return { ok: false, message: occError.message };
        }

        const expRes = rpcData as { ok: boolean; expense_id?: string } | string;
        const newExpId = typeof expRes === 'string' ? expRes : (expRes as any)?.expense_id;

        if (newExpId) {
          if (!firstExpenseId) firstExpenseId = newExpId;
          await supabase
            .from('expenses')
            .update({
              recurring_rule_id: newRule.id,
              recurring_sequence: i + 1,
            })
            .eq('id', newExpId);
        }
      }

      revalidatePath(`/trips/${tripId}`);
      revalidatePath(`/trips/${tripId}/budget`);
      revalidatePath(`/trips/${tripId}/settle`);

      return {
        ok: true,
        expenseId: firstExpenseId,
        message: `Created recurring series of ${dates.length} expenses for "${title.trim()}".`,
      };
    }
  }

  // 2. Update recurring series if editing with future/all scope
  if (expenseId && (recurrenceScope === 'future' || recurrenceScope === 'all')) {
    const { data: currentExp } = await supabase
      .from('expenses')
      .select('recurring_rule_id, spent_on')
      .eq('id', expenseId)
      .eq('trip_id', tripId)
      .single();

    if (currentExp?.recurring_rule_id) {
      let query = supabase
        .from('expenses')
        .select('id, spent_on')
        .eq('trip_id', tripId)
        .eq('recurring_rule_id', currentExp.recurring_rule_id)
        .neq('id', expenseId)
        .is('deleted_at', null);

      if (recurrenceScope === 'future') {
        query = query.gte('spent_on', currentExp.spent_on);
      }

      const { data: siblingExpenses } = await query;

      const { data: rpcData, error: updateError } = await supabase.rpc('save_expense', {
        p_expense_id: expenseId,
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

      if (updateError) {
        return { ok: false, message: updateError.message };
      }

      for (const sib of siblingExpenses || []) {
        await supabase.rpc('save_expense', {
          p_expense_id: sib.id,
          p_trip_id: tripId,
          p_title: title.trim(),
          p_amount_paise: amountPaise,
          p_category: category,
          p_paid_by: paidBy,
          p_spent_on: sib.spent_on,
          p_note: note.trim() || null,
          p_split_type: splitType,
          p_split_input: splitInput,
          p_splits: splitsPayload,
          p_expected_version: null,
        });
      }

      revalidatePath(`/trips/${tripId}`);
      revalidatePath(`/trips/${tripId}/budget`);
      revalidatePath(`/trips/${tripId}/settle`);

      return {
        ok: true,
        expenseId,
        message:
          recurrenceScope === 'all'
            ? `Updated all expenses in recurring series for "${title.trim()}".`
            : `Updated this and future expenses in recurring series for "${title.trim()}".`,
      };
    }
  }

  // 3. Standard single save_expense
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
  title: string,
  scope: 'single' | 'future' | 'all' = 'single'
): Promise<ExpenseActionResult> {
  const supabase = await createClient();

  if (scope !== 'single') {
    const { data: targetExp } = await supabase
      .from('expenses')
      .select('recurring_rule_id, spent_on')
      .eq('id', expenseId)
      .eq('trip_id', tripId)
      .single();

    if (targetExp?.recurring_rule_id) {
      let query = supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('trip_id', tripId)
        .eq('recurring_rule_id', targetExp.recurring_rule_id);

      if (scope === 'future') {
        query = query.gte('spent_on', targetExp.spent_on);
      }

      const { error } = await query;
      if (error) {
        return { ok: false, message: error.message };
      }

      revalidatePath(`/trips/${tripId}`);
      revalidatePath(`/trips/${tripId}/budget`);
      revalidatePath(`/trips/${tripId}/settle`);

      return {
        ok: true,
        expenseId,
        message:
          scope === 'all'
            ? `Removed all expenses in recurring series for "${title}".`
            : `Removed this and future recurring expenses for "${title}".`,
      };
    }
  }

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
