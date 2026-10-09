import React from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/money';

export interface BudgetBarProps {
  tripId: string;
  totalSpentPaise: number;
  budgetPaise?: number | null;
  isAdmin?: boolean;
}

export function BudgetBar({
  tripId,
  totalSpentPaise,
  budgetPaise,
  isAdmin = false,
}: BudgetBarProps) {
  if (!budgetPaise || budgetPaise <= 0) {
    return (
      <div className="border border-rule p-4 bg-paper flex items-center justify-between text-xs">
        <div>
          <span className="text-ink-2">Total spent: </span>
          <span className="font-mono font-medium text-ink tabular-nums text-sm">
            {formatPaise(totalSpentPaise)}
          </span>
          <span className="text-ink-2 ml-2">(No budget set)</span>
        </div>
        {isAdmin && (
          <Link
            href={`/trips/${tripId}/budget`}
            className="text-xs text-brick hover:text-brick-dark underline underline-offset-2"
          >
            Set budget
          </Link>
        )}
      </div>
    );
  }

  const isOverBudget = totalSpentPaise > budgetPaise;
  const remainingPaise = budgetPaise - totalSpentPaise;
  const percentUsed = Math.round((totalSpentPaise / budgetPaise) * 100);
  const barWidth = Math.min(100, Math.max(0, percentUsed));

  return (
    <div className="border border-rule p-4 bg-paper space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-y-1 text-xs">
        <div className="space-x-2">
          <span className="text-ink-2">Spent:</span>
          <span className="font-mono font-medium text-ink tabular-nums text-sm">
            {formatPaise(totalSpentPaise)}
          </span>
          <span className="text-ink-2">of {formatPaise(budgetPaise)}</span>
        </div>
        <div>
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
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full h-2 bg-paper-2 border border-rule overflow-hidden">
        <div
          className={`h-full ${isOverBudget ? 'bg-brick' : 'bg-ink'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="flex justify-end">
        <Link
          href={`/trips/${tripId}/budget`}
          className="text-[11px] text-ink-2 hover:text-ink underline underline-offset-2"
        >
          View budget and charts
        </Link>
      </div>
    </div>
  );
}
