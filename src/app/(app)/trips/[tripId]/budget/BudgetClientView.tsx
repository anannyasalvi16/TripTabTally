'use client';

import React, { useActionState, useState } from 'react';
import {
  updateTripBudgetAction,
  updateCategoryLimitAction,
  type ActionState,
} from '@/actions/budget';
import { HBarChart, type CategoryBarData } from '@/components/HBarChart';
import { BarChart, type DailyBarData } from '@/components/BarChart';
import { formatPaise } from '@/lib/money';
import { expenseCategories, type ExpenseCategory } from '@/lib/schemas/expense';

interface BudgetClientViewProps {
  tripId: string;
  tripName: string;
  budgetPaise: number | null;
  isAdmin: boolean;
  categories: CategoryBarData[];
  dailyData: DailyBarData[];
  plannedDailyAveragePaise: number | null;
  insights: string[];
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function BudgetClientView({
  tripId,
  tripName: _tripName,
  budgetPaise,
  isAdmin,
  categories,
  dailyData,
  plannedDailyAveragePaise,
  insights,
}: BudgetClientViewProps) {
  const [budgetState, budgetAction, isPendingBudget] = useActionState<ActionState | null, FormData>(
    updateTripBudgetAction,
    null
  );

  const [limitCategory, setLimitCategory] = useState<ExpenseCategory>('food');
  const [limitState, limitAction, isPendingLimit] = useActionState<ActionState | null, FormData>(
    updateCategoryLimitAction,
    null
  );

  const totalSpentPaise = categories.reduce((sum, c) => sum + c.amountPaise, 0);
  const isOverBudget = budgetPaise ? totalSpentPaise > budgetPaise : false;
  const remainingPaise = budgetPaise ? budgetPaise - totalSpentPaise : 0;
  const percentUsed = budgetPaise ? Math.round((totalSpentPaise / budgetPaise) * 100) : 0;
  const barWidth = budgetPaise ? Math.min(100, Math.max(0, percentUsed)) : 0;

  // Find any category over limit
  const overLimitCategories = categories.filter(
    (c) => c.limitPaise && c.amountPaise > c.limitPaise
  );

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="border-b border-rule pb-3">
        <h2 className="font-serif text-2xl font-normal text-ink">Trip budget</h2>
        <p className="text-xs text-ink-2 mt-1">
          Track spending against your shared budget and category limits.
        </p>
      </div>

      {/* Action notices */}
      {budgetState?.message && (
        <div
          aria-live="polite"
          className={`p-3 border text-xs ${
            budgetState.ok
              ? 'border-rule bg-paper text-ink'
              : 'border-brick bg-paper text-brick'
          }`}
        >
          {budgetState.message}
        </div>
      )}

      {limitState?.message && (
        <div
          aria-live="polite"
          className={`p-3 border text-xs ${
            limitState.ok
              ? 'border-rule bg-paper text-ink'
              : 'border-brick bg-paper text-brick'
          }`}
        >
          {limitState.message}
        </div>
      )}

      {/* Total Budget Card */}
      <div className="border border-rule p-5 bg-paper space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-y-2">
          <div>
            <h3 className="text-xs font-mono uppercase text-ink-2">Total budget</h3>
            <p className="font-serif text-3xl text-ink mt-0.5">
              {budgetPaise ? formatPaise(budgetPaise) : 'No budget set'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-ink-2">Total spent: </span>
            <span className="font-mono text-sm tabular-nums text-ink font-medium">
              {formatPaise(totalSpentPaise)}
            </span>
            {budgetPaise && (
              <p className="text-xs mt-0.5">
                {isOverBudget ? (
                  <span className="text-brick font-medium">
                    {formatPaise(Math.abs(remainingPaise))} over budget ({percentUsed}%)
                  </span>
                ) : (
                  <span className="text-ink-2">
                    <span className="font-mono tabular-nums text-ink">
                      {formatPaise(remainingPaise)}
                    </span>{' '}
                    remaining ({percentUsed}% used)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {budgetPaise && (
          <div className="w-full h-2.5 bg-paper-2 border border-rule overflow-hidden">
            <div
              className={`h-full ${isOverBudget ? 'bg-brick' : 'bg-ink'}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        )}

        {/* Admin total budget edit form */}
        {isAdmin && (
          <form action={budgetAction} className="border-t border-rule pt-4 mt-4">
            <input type="hidden" name="tripId" value={tripId} />
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="budgetRupees" className="text-xs text-ink-2 font-medium">
                Set total budget (₹):
              </label>
              <input
                id="budgetRupees"
                name="budgetRupees"
                type="text"
                inputMode="decimal"
                defaultValue={budgetPaise ? (budgetPaise / 100).toFixed(2) : ''}
                placeholder="e.g. 50000"
                className="w-36 px-2.5 py-1 text-xs font-mono border border-rule bg-paper text-ink focus:outline-none"
              />
              <button
                type="submit"
                disabled={isPendingBudget}
                className="px-3 py-1 text-xs bg-brick text-paper hover:bg-brick-dark disabled:opacity-50"
              >
                {isPendingBudget ? 'Saving...' : 'Update budget'}
              </button>
            </div>
            {budgetState?.fieldErrors?.budgetRupees && (
              <p className="text-xs text-brick mt-1">
                {budgetState.fieldErrors.budgetRupees}
              </p>
            )}
          </form>
        )}
      </div>

      {/* Over-limit warning alerts if any */}
      {overLimitCategories.length > 0 && (
        <div className="border border-brick p-4 bg-paper space-y-1">
          <h4 className="text-xs font-mono uppercase text-brick font-medium">
            Category limit alerts
          </h4>
          {overLimitCategories.map((c) => {
            const overPaise = c.amountPaise - (c.limitPaise ?? 0);
            return (
              <p key={c.category} className="text-xs text-brick">
                {capitalize(c.category)} is {formatPaise(overPaise)} over its limit of{' '}
                {formatPaise(c.limitPaise!)}.
              </p>
            );
          })}
        </div>
      )}

      {/* Computed insights */}
      {insights.length > 0 && (
        <div className="border border-rule p-4 bg-paper space-y-2">
          <h3 className="text-xs font-mono uppercase text-ink-2">Insights</h3>
          <ul className="space-y-1 text-xs text-ink list-disc list-inside">
            {insights.map((sentence, idx) => (
              <li key={idx}>{sentence}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Spend by category chart */}
      <div className="space-y-3">
        <div className="border-b border-rule pb-1.5 flex justify-between items-baseline">
          <h3 className="font-serif text-lg text-ink font-normal">Spend by category</h3>
          <span className="text-xs text-ink-2 font-mono">Sorted by amount</span>
        </div>
        <HBarChart data={categories} />
      </div>

      {/* Spend per day chart */}
      <div className="space-y-3">
        <div className="border-b border-rule pb-1.5 flex justify-between items-baseline">
          <h3 className="font-serif text-lg text-ink font-normal">Spend per day</h3>
          {plannedDailyAveragePaise && (
            <span className="text-xs text-ink-2 font-mono">
              Planned avg: {formatPaise(plannedDailyAveragePaise)} / day
            </span>
          )}
        </div>
        <BarChart data={dailyData} plannedDailyAveragePaise={plannedDailyAveragePaise} />
      </div>

      {/* Category limits table and admin manager */}
      <div className="space-y-4">
        <div className="border-b border-rule pb-1.5">
          <h3 className="font-serif text-lg text-ink font-normal">Category limits</h3>
        </div>

        <div className="border-t border-rule divide-y divide-rule text-xs">
          {categories.map((c) => {
            const isOver = !!(c.limitPaise && c.amountPaise > c.limitPaise);
            return (
              <div
                key={c.category}
                className="py-2.5 flex justify-between items-center"
              >
                <div>
                  <span className="capitalize font-medium text-ink">
                    {c.category}
                  </span>
                  {isOver && (
                    <span className="ml-2 text-brick font-medium">
                      (Over limit by {formatPaise(c.amountPaise - c.limitPaise!)})
                    </span>
                  )}
                </div>
                <div className="space-x-4">
                  <span className="text-ink-2">
                    Spent:{' '}
                    <span className="font-mono tabular-nums text-ink">
                      {formatPaise(c.amountPaise)}
                    </span>
                  </span>
                  <span className="text-ink-2">
                    Limit:{' '}
                    <span className="font-mono tabular-nums text-ink">
                      {c.limitPaise ? formatPaise(c.limitPaise) : 'None'}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin set category limit form */}
        {isAdmin && (
          <form action={limitAction} className="border border-rule p-4 bg-paper space-y-3">
            <h4 className="text-xs font-mono uppercase text-ink-2">
              Set or update category limit
            </h4>
            <input type="hidden" name="tripId" value={tripId} />
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label htmlFor="category" className="sr-only">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={limitCategory}
                  onChange={(e) => setLimitCategory(e.target.value as ExpenseCategory)}
                  className="px-2.5 py-1 text-xs border border-rule bg-paper text-ink capitalize"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {capitalize(cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="limitRupees" className="sr-only">
                  Limit rupees
                </label>
                <input
                  id="limitRupees"
                  name="limitRupees"
                  type="text"
                  inputMode="decimal"
                  placeholder="Limit in ₹ (leave empty to clear)"
                  className="w-48 px-2.5 py-1 text-xs font-mono border border-rule bg-paper text-ink focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isPendingLimit}
                className="px-3 py-1 text-xs bg-brick text-paper hover:bg-brick-dark disabled:opacity-50"
              >
                {isPendingLimit ? 'Saving...' : 'Save limit'}
              </button>
            </div>
            {limitState?.fieldErrors?.limitRupees && (
              <p className="text-xs text-brick">
                {limitState.fieldErrors.limitRupees}
              </p>
            )}
            <p className="text-[11px] text-ink-2">
              Leave limit empty to remove the spending limit for the selected category.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
