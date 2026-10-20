'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/money';
import { deleteExpenseAction, restoreExpenseAction } from '@/actions/expenses';

interface ExpenseItem {
  id: string;
  title: string;
  amount_paise: number;
  category: string;
  paid_by: string;
  spent_on: string;
  split_type: string;
  created_by: string;
  version: number;
  payerName: string;
  splitsCount: number;
  recurring_rule_id?: string | null;
  recurring_sequence?: number | null;
}

interface ExpenseListProps {
  tripId: string;
  expenses: ExpenseItem[];
  isAdmin: boolean;
  currentMemberId?: string;
  onEditExpense?: (expense: ExpenseItem) => void;
}

export function ExpenseList({
  tripId,
  expenses,
  isAdmin,
  currentMemberId,
  onEditExpense,
}: ExpenseListProps) {
  const [notice, setNotice] = useState<{ message: string; undoId?: string; undoTitle?: string } | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recurringDeleteExpense, setRecurringDeleteExpense] = useState<ExpenseItem | null>(null);

  async function executeDelete(expense: ExpenseItem, scope: 'single' | 'future' | 'all') {
    setDeletingId(expense.id);
    setRecurringDeleteExpense(null);
    try {
      const res = await deleteExpenseAction(tripId, expense.id, expense.title, scope);
      if (res.ok) {
        setNotice({
          message: res.message || `Removed "${expense.title}".`,
          undoId: scope === 'single' ? expense.id : undefined,
          undoTitle: scope === 'single' ? expense.title : undefined,
        });
      } else {
        setNotice({ message: res.message || 'Could not delete expense.' });
      }
    } catch {
      setNotice({ message: 'Could not delete expense.' });
    } finally {
      setDeletingId(null);
    }
  }

  function handleDeleteClick(expense: ExpenseItem) {
    if (expense.recurring_rule_id) {
      setRecurringDeleteExpense(expense);
      return;
    }
    if (!window.confirm(`Delete "${expense.title}"?`)) return;
    executeDelete(expense, 'single');
  }

  async function handleUndo() {
    if (!notice?.undoId || !notice?.undoTitle) return;
    try {
      const res = await restoreExpenseAction(tripId, notice.undoId, notice.undoTitle);
      if (res.ok) {
        setNotice({ message: res.message || 'Restored expense.' });
      }
    } catch {
      setNotice({ message: 'Could not restore expense.' });
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="p-3 border border-rule bg-paper-2 text-xs text-ink flex items-center justify-between">
          <span>{notice.message}</span>
          {notice.undoId && (
            <button
              type="button"
              onClick={handleUndo}
              className="text-brick font-medium hover:underline ml-4"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="py-12 text-center border-b border-rule">
          <p className="text-sm text-ink-2">
            No expenses found.
          </p>
        </div>
      ) : (
        <div className="border-t border-rule divide-y divide-rule">
          {expenses.map((expense) => {
            const canModify = isAdmin || expense.created_by === currentMemberId;
            return (
              <div
                key={expense.id}
                className="py-3 px-2 hover:bg-paper-2 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                {/* Mobile: Line 1 (title & amount) | Desktop: left cell */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-ink text-sm truncate">
                        {expense.title}
                      </span>
                      {expense.recurring_rule_id && (
                        <span
                          title={expense.recurring_sequence ? `Occurrence #${expense.recurring_sequence}` : 'Recurring expense'}
                          className="text-[10px] font-mono uppercase px-1.5 py-0.2 border border-rule text-ink-2 shrink-0"
                        >
                          Recurring
                        </span>
                      )}
                    </div>
                    <span className="sm:hidden font-mono text-sm tabular-numbers text-ink font-medium">
                      {formatPaise(expense.amount_paise)}
                    </span>
                  </div>

                  {/* Line 2 (payer, category, date, split count) */}
                  <div className="text-xs text-ink-2 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>{expense.payerName} paid</span>
                    <span>•</span>
                    <span className="capitalize">{expense.category}</span>
                    <span>•</span>
                    <span>{expense.spent_on}</span>
                    <span>•</span>
                    <span className="capitalize">{expense.split_type} ({expense.splitsCount})</span>
                  </div>
                </div>

                {/* Desktop: right cell with amount and action links */}
                <div className="hidden sm:flex items-center space-x-4 text-right">
                  <span className="font-mono text-sm tabular-numbers text-ink font-medium">
                    {formatPaise(expense.amount_paise)}
                  </span>

                  {canModify && (
                    <div className="flex items-center space-x-2 text-xs">
                      {onEditExpense ? (
                        <button
                          type="button"
                          onClick={() => onEditExpense(expense)}
                          className="text-ink-2 hover:text-ink underline"
                        >
                          Edit
                        </button>
                      ) : (
                        <Link
                          href={`/trips/${tripId}/expenses/${expense.id}`}
                          className="text-ink-2 hover:text-ink underline"
                        >
                          Edit
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(expense)}
                        disabled={deletingId === expense.id}
                        className="text-brick hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile actions */}
                {canModify && (
                  <div className="sm:hidden flex items-center space-x-3 text-xs pt-1">
                    {onEditExpense ? (
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="text-ink-2 hover:text-ink underline"
                      >
                        Edit
                      </button>
                    ) : (
                      <Link
                        href={`/trips/${tripId}/expenses/${expense.id}`}
                        className="text-ink-2 hover:text-ink underline"
                      >
                        Edit
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(expense)}
                      disabled={deletingId === expense.id}
                      className="text-brick hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recurring Delete Modal */}
      {recurringDeleteExpense && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-paper border border-ink p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-baseline border-b border-rule pb-2">
              <h4 className="font-serif text-base text-ink font-normal">
                Delete recurring expense
              </h4>
              <button
                type="button"
                onClick={() => setRecurringDeleteExpense(null)}
                className="text-xs text-ink-2 hover:text-ink font-mono"
              >
                [Cancel]
              </button>
            </div>

            <p className="text-xs text-ink">
              &ldquo;{recurringDeleteExpense.title}&rdquo; is part of a recurring series. How would you like to delete?
            </p>

            <div className="space-y-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => executeDelete(recurringDeleteExpense, 'single')}
                className="w-full text-left px-3 py-2 border border-rule hover:bg-paper-2 text-ink font-medium"
              >
                Only this expense
              </button>
              <button
                type="button"
                onClick={() => executeDelete(recurringDeleteExpense, 'future')}
                className="w-full text-left px-3 py-2 border border-rule hover:bg-paper-2 text-ink font-medium"
              >
                This and future expenses in series
              </button>
              <button
                type="button"
                onClick={() => executeDelete(recurringDeleteExpense, 'all')}
                className="w-full text-left px-3 py-2 border border-brick bg-paper text-brick hover:bg-paper-2 font-medium"
              >
                All expenses in series
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
