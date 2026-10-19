'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  parseRupeesToPaise,
  formatPaise,
  splitEqual,
  splitExact,
  splitPercent,
  splitShares,
  splitFamily,
} from '@/lib/money';
import { saveExpenseAction, type ExpenseActionResult } from '@/actions/expenses';
import {
  expenseCategories,
  validateExpenseDate,
  formatIsoToDisplay,
  parseDateInput,
  type ExpenseCategory,
  type SplitType,
} from '@/lib/schemas/expense';
import { MoneyInput } from './MoneyInput';
import { DateInput } from './DateInput';

export interface Member {
  id: string;
  display_name: string;
  family_id?: string | null;
  family_name?: string | null;
}

export interface Family {
  id: string;
  name: string;
}

interface ExpenseFormProps {
  tripId: string;
  members: Member[];
  families?: Family[];
  currentMemberId?: string;
  startDate?: string | null;
  endDate?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
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
  families = [],
  currentMemberId,
  startDate: propStartDate,
  endDate: propEndDate,
  tripStartDate,
  tripEndDate,
  initialData,
  onSuccess,
}: ExpenseFormProps) {
  const router = useRouter();

  const startDate = propStartDate ?? tripStartDate ?? null;
  const endDate = propEndDate ?? tripEndDate ?? null;

  const [title, setTitle] = useState(initialData?.title || '');
  const [amountRupees, setAmountRupees] = useState(initialData?.amountRupees || '');
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'food');
  const [paidBy, setPaidBy] = useState(initialData?.paidBy || currentMemberId || members[0]?.id || '');

  const getDefaultSpentOn = () => {
    if (initialData?.spentOn) return initialData.spentOn;
    const today = new Date().toISOString().split('T')[0];
    if (startDate && today < startDate) return startDate;
    if (endDate && today > endDate) return endDate;
    return today;
  };

  const initialIso = getDefaultSpentOn();
  const [spentOn, setSpentOn] = useState(initialIso);
  const [dateError, setDateError] = useState<string | null>(null);
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
    familyShares?: Record<string, number>;
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
    } else if (splitType === 'family') {
      if (selectedMemberIds.length === 0) {
        livePreview = { shares: {}, error: 'Select at least one member or family.', isValid: false };
      } else {
        const memberInputs = members.map((m) => ({ id: m.id, familyId: m.family_id }));
        const res = splitFamily(totalPaise, memberInputs, selectedMemberIds, title);
        if (res.ok) {
          livePreview = {
            shares: res.data.memberShares,
            familyShares: res.data.familyShares,
            isValid: true,
          };
        } else {
          livePreview = { shares: {}, error: res.error, isValid: false };
        }
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
        shMap[m.id] = parseFloat(shares[m.id] || '1');
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
      : splitType === 'family'
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (dateError) {
      e.preventDefault();
      return;
    }
    const res = validateExpenseDate(spentOn, startDate, endDate);
    if (!res.valid) {
      e.preventDefault();
      setDateError(res.error || 'Invalid date.');
      return;
    }
    setDateError(null);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="tripId" value={tripId} />
      {startDate && <input type="hidden" name="tripStartDate" value={startDate} />}
      {endDate && <input type="hidden" name="tripEndDate" value={endDate} />}
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}
      {initialData?.version && (
        <input type="hidden" name="version" value={initialData.version.toString()} />
      )}
      <input type="hidden" name="splitType" value={splitType} />
      <input type="hidden" name="splitInput" value={JSON.stringify(splitInputPayload)} />

      {(dateError || (state && !state.ok && state.message)) && (
        <div className="p-3 border border-brick text-brick text-xs bg-paper-2">
          {dateError || state?.message}
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

        <DateInput
          id="spentOn"
          name="spentOn"
          label="Date"
          required
          value={spentOn}
          min={startDate || undefined}
          max={endDate || undefined}
          error={dateError || state?.fieldErrors?.spentOn}
          onChange={(iso) => {
            setSpentOn(iso);
            setDateError(null);
          }}
          onError={(err) => {
            setDateError(err);
          }}
        />
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
        <div className="flex flex-wrap border-b border-rule mb-4 text-xs font-medium gap-1">
          {[
            { id: 'equal', label: 'Equally per person' },
            { id: 'family', label: 'Equally per family' },
            { id: 'shares', label: 'Weighted shares' },
            { id: 'exact', label: 'Custom amounts' },
            { id: 'percent', label: 'Percentage' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSplitType(id as SplitType)}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                splitType === id
                  ? 'border-brick text-brick'
                  : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {label}
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

        {/* Tab 2: Family Split */}
        {splitType === 'family' && (
          <div className="space-y-4">
            <p className="text-xs text-ink-2">
              Each participating family (and solo member) pays 1 share, divided equally among its members.
            </p>

            {/* Families */}
            {families.map((fam) => {
              const famMembers = members.filter((m) => m.family_id === fam.id);
              if (famMembers.length === 0) return null;
              const allFamSelected = famMembers.every((m) => selectedMemberIds.includes(m.id));
              const someFamSelected = famMembers.some((m) => selectedMemberIds.includes(m.id));

              return (
                <div key={fam.id} className="border border-rule p-3 bg-paper-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs text-ink">{fam.name} ({famMembers.length} members)</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (allFamSelected) {
                          // Deselect all members of this family
                          setSelectedMemberIds((prev) => prev.filter((id) => !famMembers.some((fm) => fm.id === id)));
                        } else {
                          // Select all members of this family
                          const idsToAdd = famMembers.map((m) => m.id);
                          setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
                        }
                      }}
                      className="text-[11px] underline text-ink-2 hover:text-ink"
                    >
                      {allFamSelected ? 'Deselect family' : 'Select entire family'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {famMembers.map((m) => {
                      const isSelected = selectedMemberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleEqualMember(m.id)}
                          className={`text-left p-1.5 border text-xs flex justify-between items-center transition-colors ${
                            isSelected
                              ? 'border-ink bg-paper text-ink font-medium'
                              : 'border-rule text-ink-2 hover:border-ink'
                          }`}
                        >
                          <span>{m.display_name}</span>
                          <span className="font-mono text-xs">{isSelected ? '[x]' : '[ ]'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Solo Members */}
            {(() => {
              const soloMembers = members.filter((m) => !m.family_id);
              if (soloMembers.length === 0) return null;
              return (
                <div className="border border-rule p-3 bg-paper-2">
                  <span className="font-medium text-xs text-ink block mb-2">Solo Members (1 share each)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {soloMembers.map((m) => {
                      const isSelected = selectedMemberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleEqualMember(m.id)}
                          className={`text-left p-1.5 border text-xs flex justify-between items-center transition-colors ${
                            isSelected
                              ? 'border-ink bg-paper text-ink font-medium'
                              : 'border-rule text-ink-2 hover:border-ink'
                          }`}
                        >
                          <span>{m.display_name}</span>
                          <span className="font-mono text-xs">{isSelected ? '[x]' : '[ ]'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 3: Exact Split */}
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

        {/* Tab 4: Percent Split */}
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

        {/* Tab 5: Shares Split */}
        {splitType === 'shares' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2 mb-2">
              Set relative weights (e.g. Adult 1, Kid 0.5):
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink flex-1 truncate">{m.display_name}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShares((prev) => ({ ...prev, [m.id]: '1' }))}
                      className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:text-ink hover:border-ink"
                    >
                      Adult (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShares((prev) => ({ ...prev, [m.id]: '0.5' }))}
                      className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:text-ink hover:border-ink"
                    >
                      Kid (0.5)
                    </button>
                    <div className="w-20">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={shares[m.id] || '1'}
                        onChange={(e) =>
                          setShares((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        className="w-full border border-rule bg-paper-2 px-2 py-1.5 text-xs text-ink text-right focus:border-brick font-mono"
                      />
                    </div>
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

          {/* Family breakdown if family split or family shares exist */}
          {livePreview.familyShares && Object.keys(livePreview.familyShares).length > 0 && (
            <div className="mb-3 space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-2 block">
                Family & Solo shares summary
              </span>
              <div className="border border-rule divide-y divide-rule bg-paper">
                {Object.entries(livePreview.familyShares).map(([key, paise]) => {
                  const famName =
                    families.find((f) => f.id === key)?.name ||
                    members.find((m) => m.id === key.replace('solo:', ''))?.display_name ||
                    'Family';
                  return (
                    <div key={key} className="py-1.5 px-3 flex justify-between items-center text-xs">
                      <span className="font-medium text-ink">{famName}</span>
                      <span className="font-mono tabular-numbers font-medium text-brick">
                        {formatPaise(paise)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="divide-y divide-rule border border-rule text-xs">
            {members.map((m) => {
              const sharePaise = livePreview.shares[m.id] || 0;
              return (
                <div key={m.id} className="py-2 px-3 flex justify-between items-center bg-paper-2">
                  <span className="text-ink">
                    {m.display_name}
                    {m.family_name ? <span className="text-ink-2 ml-1">({m.family_name})</span> : null}
                  </span>
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
