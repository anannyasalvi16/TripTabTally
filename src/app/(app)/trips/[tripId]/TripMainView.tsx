'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/money';
import { BudgetBar } from '@/components/BudgetBar';
import { ExpenseList } from '@/components/ExpenseList';
import { ExpenseFilters } from '@/components/ExpenseFilters';
import { BalancesSummary } from '@/components/BalancesSummary';
import { ExpenseForm } from '@/components/ExpenseForm';
import type { SplitType, ExpenseCategory } from '@/lib/schemas/expense';

interface Member {
  id: string;
  display_name: string;
}

interface MemberBalance {
  id: string;
  display_name: string;
  netPaise: number;
}

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
  split_input?: Record<string, any>;
  note?: string | null;
}

interface TripMainViewProps {
  tripId: string;
  totalBudgetPaise: number | null;
  allTotalSpentPaise?: number;
  members: Member[];
  expenses: ExpenseItem[];
  balances: MemberBalance[];
  isAdmin: boolean;
  currentMemberId?: string;
}

export function TripMainView({
  tripId,
  totalBudgetPaise,
  allTotalSpentPaise,
  members,
  expenses,
  balances,
  isAdmin,
  currentMemberId,
}: TripMainViewProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  const totalSpentPaise = allTotalSpentPaise ?? expenses.reduce((acc, e) => acc + e.amount_paise, 0);

  function handleOpenAdd() {
    setEditingExpense(null);
    setPanelOpen(true);
  }

  function handleEditExpense(expense: ExpenseItem) {
    setEditingExpense(expense);
    setPanelOpen(true);
  }

  function handleClosePanel() {
    setPanelOpen(false);
    setEditingExpense(null);
  }

  return (
    <div className="space-y-6">
      {/* Budget Summary Bar */}
      <BudgetBar
        tripId={tripId}
        totalSpentPaise={totalSpentPaise}
        budgetPaise={totalBudgetPaise}
        isAdmin={isAdmin}
      />

      {/* Main responsive grid: 1 column on mobile, 2 columns on tablet/desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Balances (4 cols on tablet/desktop) */}
        <div className="md:col-span-4 space-y-6">
          <BalancesSummary balances={balances} />

          <div className="border border-rule p-4 bg-paper text-xs text-ink-2 space-y-2">
            <h2 className="font-serif text-sm text-ink font-normal">Quick links</h2>
            <div className="flex flex-col space-y-1.5">
              <Link href={`/trips/${tripId}/people`} className="hover:underline text-ink">
                Manage members and invite link
              </Link>
              <Link href={`/trips/${tripId}/settle`} className="hover:underline text-ink">
                View settle up plan
              </Link>
              <Link href={`/trips/${tripId}/budget`} className="hover:underline text-ink">
                Category budget and charts
              </Link>
              <a
                href={`/api/trips/${tripId}/export`}
                className="hover:underline text-ink"
              >
                Export data to CSV
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Expenses (8 cols on tablet/desktop, with side panel on desktop) */}
        <div className={`md:col-span-8 ${panelOpen ? 'xl:grid xl:grid-cols-2 xl:gap-6' : ''}`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-normal text-ink">
                Expenses ({expenses.length})
              </h2>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="hidden xl:inline-block bg-brick hover:bg-brick-dark text-paper px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  + Add expense
                </button>
                <Link
                  href={`/trips/${tripId}/expenses/new`}
                  className="xl:hidden bg-brick hover:bg-brick-dark text-paper px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  + Add expense
                </Link>
              </div>
            </div>

            {/* URL Filter Controls */}
            <ExpenseFilters members={members} />

            {/* Expense List */}
            <ExpenseList
              tripId={tripId}
              expenses={expenses}
              isAdmin={isAdmin}
              currentMemberId={currentMemberId}
              onEditExpense={handleEditExpense}
            />
          </div>

          {/* Desktop Side Panel (1280px+) */}
          {panelOpen && (
            <div className="hidden xl:block border border-rule p-6 bg-paper relative">
              <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
                <h3 className="font-serif text-lg font-normal text-ink">
                  {editingExpense ? 'Edit expense' : 'New expense'}
                </h3>
                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="text-xs text-ink-2 hover:text-ink px-1.5 py-0.5 border border-rule"
                >
                  Close
                </button>
              </div>

              <ExpenseForm
                tripId={tripId}
                members={members}
                currentMemberId={currentMemberId}
                initialData={
                  editingExpense
                    ? {
                        id: editingExpense.id,
                        title: editingExpense.title,
                        amountRupees: (editingExpense.amount_paise / 100).toString(),
                        category: editingExpense.category as ExpenseCategory,
                        paidBy: editingExpense.paid_by,
                        spentOn: editingExpense.spent_on,
                        note: editingExpense.note || '',
                        splitType: (editingExpense.split_type || 'equal') as SplitType,
                        splitInput: editingExpense.split_input || {},
                        version: editingExpense.version,
                      }
                    : undefined
                }
                onSuccess={handleClosePanel}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
