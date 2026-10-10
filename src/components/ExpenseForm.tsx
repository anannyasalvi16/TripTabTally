'use client';

import { useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  parseRupeesToPaise,
  formatPaise,
  splitEqual,
  splitExact,
  splitPercent,
  splitShares,
} from '@/lib/money';
import { saveExpenseAction, type ExpenseActionResult } from '@/actions/expenses';
import { expenseCategories, type ExpenseCategory, type SplitType } from '@/lib/schemas/expense';
import { MoneyInput } from './MoneyInput';

interface Member {
  id: string;
  display_name: string;
}

interface ExpenseFormProps {
  tripId: string;
  members: Member[];
  currentMemberId?: string;
  initialData?: {
    id?: string;
    title: string;
    amountRupees: string;
    category: ExpenseCategory;
    paidBy: string;
    spentOn: string;
    note?: string | null;
    splitType: SplitType;
    splitInput?: Record<string, any>;
    version?: number;
  };
  onSuccess?: () => void;
}

export function ExpenseForm({
  tripId,
  members,
  currentMemberId,
  initialData,
  onSuccess,
}: ExpenseFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [amountRupees, setAmountRupees] = useState(initialData?.amountRupees || '');
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'food');
  const [paidBy, setPaidBy] = useState(initialData?.paidBy || currentMemberId || members[0]?.id || '');
  const [spentOn, setSpentOn] = useState(
    initialData?.spentOn || new Date().toISOString().split('T')[0] || ''
  );
  const [note, setNote] = useState(initialData?.note || '');
  const [splitType, setSplitType] = useState<SplitType>(initialData?.splitType || 'equal');

  // Equal split selection (default: all members)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    initialData?.splitInput?.memberIds || members.map((m) => m.id)
  );

  // Exact split amounts
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(
    initialData?.splitInput?.amounts || {}
  );

  // Percent split values
  const [percentages, setPercentages] = useState<Record<string, string>>(
    initialData?.splitInput?.percentages || {}
  );

  // Shares split values
  const [shares, setShares] = useState<Record<string, string>>(
    initialData?.splitInput?.shares ||
      Object.fromEntries(members.map((m) => [m.id, '1']))
  );

  const [state, formAction, isPending] = useActionState<ExpenseActionResult | null, FormData>(
    saveExpenseAction,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/trips/${tripId}`);
      }
    }
  }, [state, onSuccess, router, tripId]);

  // Live split calculation
  const parsedTotal = parseRupeesToPaise(amountRupees);
  const totalPaise = parsedTotal.ok ? parsedTotal.data : 0;

  let livePreview: {
    shares: Record<string, number>;
    error?: string;
    isValid: boolean;
  } = { shares: {}, isValid: false };

  if (totalPaise > 0) {
    if (splitType === 'equal') {
      if (selectedMemberIds.length === 0) {
        livePreview = { shares: {}, error: 'Select at least one person.', isValid: false };
      } else {
        const res = splitEqual(totalPaise, selectedMemberIds, title);
        livePreview = { shares: res, isValid: true };
      }
    } else if (splitType === 'exact') {
      const paiseMap: Record<string, number> = {};
      for (const m of members) {
        const p = parseRupeesToPaise(exactAmounts[m.id] || '0');
        paiseMap[m.id] = p.ok ? p.data : 0;
      }
      const res = splitExact(totalPaise, paiseMap);
      if (res.ok) {
        livePreview = { shares: res.data, isValid: true };
      } else {
        livePreview = { shares: paiseMap, error: res.error, isValid: false };
      }
    } else if (splitType === 'percent') {
      const pctMap: Record<string, number> = {};
      for (const m of members) {
        pctMap[m.id] = parseFloat(percentages[m.id] || '0');
      }
      const res = splitPercent(totalPaise, pctMap);
      if (res.ok) {
        livePreview = { shares: res.data, isValid: true };
      } else {
        livePreview = { shares: {}, error: res.error, isValid: false };
      }
    } else if (splitType === 'shares') {
      const shMap: Record<string, number> = {};
      for (const m of members) {
        shMap[m.id] = parseInt(shares[m.id] || '1', 10);
      }
      const res = splitShares(totalPaise, shMap);
      if (res.ok) {
        livePreview = { shares: res.data, isValid: true };
      } else {
        livePreview = { shares: {}, error: res.error, isValid: false };
      }
    }
  }

  // Construct splitInput JSON
  const splitInputPayload =
    splitType === 'equal'
      ? { memberIds: selectedMemberIds }
      : splitType === 'exact'
      ? { amounts: exactAmounts }
      : splitType === 'percent'
      ? { percentages }
      : { shares };

  function toggleEqualMember(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tripId" value={tripId} />
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}
      {initialData?.version && (
        <input type="hidden" name="version" value={initialData.version.toString()} />
      )}
      <input type="hidden" name="splitType" value={splitType} />
      <input type="hidden" name="splitInput" value={JSON.stringify(splitInputPayload)} />

      {state && !state.ok && state.message && (
        <div className="p-3 border border-brick text-brick text-xs bg-paper-2">
          {state.message}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-xs font-medium text-ink mb-1">
          Description <span className="text-brick">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Cab to Candolim"
          className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
        />
      </div>

      {/* Amount and Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="amountRupees" className="block text-xs font-medium text-ink mb-1">
            Amount in rupees <span className="text-brick">*</span>
          </label>
          <MoneyInput
            id="amountRupees"
            name="amountRupees"
            required
            defaultValue={amountRupees}
            onValueChange={setAmountRupees}
            placeholder="1,200.00"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-xs font-medium text-ink mb-1">
            Category <span className="text-brick">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink focus:border-brick capitalize"
          >
            {expenseCategories.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paid By and Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="paidBy" className="block text-xs font-medium text-ink mb-1">
            Paid by <span className="text-brick">*</span>
          </label>
          <select
            id="paidBy"
            name="paidBy"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink focus:border-brick"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name} {m.id === currentMemberId ? '(Me)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="spentOn" className="block text-xs font-medium text-ink mb-1">
            Date <span className="text-brick">*</span>
          </label>
          <input
            id="spentOn"
            name="spentOn"
            type="date"
            required
            value={spentOn}
            onChange={(e) => setSpentOn(e.target.value)}
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink focus:border-brick"
          />
        </div>
      </div>

      {/* Note */}
      <div>
        <label htmlFor="note" className="block text-xs font-medium text-ink-2 mb-1">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Split equally excluding Karan"
          className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
        />
      </div>

      {/* Split Types Tabs */}
      <div className="border border-rule p-4 bg-paper">
        <span className="text-xs font-mono text-ink-2 uppercase tracking-wider block mb-2">
          Split method
        </span>
        <div className="flex border-b border-rule mb-4 text-xs font-medium">
          {(['equal', 'exact', 'percent', 'shares'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSplitType(type)}
              className={`pb-2 px-3 capitalize border-b-2 transition-colors ${
                splitType === type
                  ? 'border-brick text-brick'
                  : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Tab 1: Equal Split */}
        {splitType === 'equal' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2 mb-2">
              Select members to include in equal split:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {members.map((m) => {
                const isSelected = selectedMemberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleEqualMember(m.id)}
                    className={`text-left p-2 border text-xs flex justify-between items-center transition-colors ${
                      isSelected
                        ? 'border-ink bg-paper-2 text-ink font-medium'
                        : 'border-rule text-ink-2 hover:border-ink'
                    }`}
                  >
                    <span>{m.display_name}</span>
                    <span className="font-mono text-xs text-ink">{isSelected ? '[x]' : '[ ]'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Exact Split */}
        {splitType === 'exact' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2 mb-2">
              Enter exact rupee amount for each person:
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink flex-1 truncate">{m.display_name}</span>
                  <div className="w-36">
                    <MoneyInput
                      id={`exact_${m.id}`}
                      name={`exact_${m.id}`}
                      defaultValue={exactAmounts[m.id] || ''}
                      onValueChange={(val) =>
                        setExactAmounts((prev) => ({ ...prev, [m.id]: val }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Percent Split */}
        {splitType === 'percent' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2 mb-2">
              Enter percentage for each person (must add up to 100):
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink flex-1 truncate">{m.display_name}</span>
                  <div className="w-24 relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={percentages[m.id] || ''}
                      onChange={(e) =>
                        setPercentages((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      placeholder="0"
                      className="w-full border border-rule bg-paper-2 px-2 py-1.5 text-xs text-ink text-right focus:border-brick font-mono"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-ink-2 select-none">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Shares Split */}
        {splitType === 'shares' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2 mb-2">
              Enter relative shares as whole numbers (e.g. 1 for single, 2 for couple):
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink flex-1 truncate">{m.display_name}</span>
                  <div className="w-20">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={shares[m.id] || '1'}
                      onChange={(e) =>
                        setShares((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      className="w-full border border-rule bg-paper-2 px-2 py-1.5 text-xs text-ink text-right focus:border-brick font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Split Preview */}
        <div className="mt-6 border-t border-rule pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink">Live split breakdown</span>
            {livePreview.error && (
              <span className="text-xs text-brick font-medium">
                {livePreview.error}
              </span>
            )}
          </div>

          <div className="divide-y divide-rule border border-rule text-xs">
            {members.map((m) => {
              const sharePaise = livePreview.shares[m.id] || 0;
              return (
                <div key={m.id} className="py-2 px-3 flex justify-between items-center bg-paper-2">
                  <span className="text-ink">{m.display_name}</span>
                  <span className="font-mono tabular-numbers text-ink font-medium">
                    {formatPaise(sharePaise)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || (totalPaise > 0 && !livePreview.isValid)}
          className="bg-brick hover:bg-brick-dark text-paper px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending
            ? 'Saving expense...'
            : initialData?.id
            ? 'Save changes'
            : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
