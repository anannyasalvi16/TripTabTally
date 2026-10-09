import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ExpenseForm } from '@/components/ExpenseForm';
import type { ExpenseCategory, SplitType } from '@/lib/schemas/expense';

interface EditExpensePageProps {
  params: Promise<{ tripId: string; expenseId: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { tripId, expenseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load expense
  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .single();

  if (!expense) {
    notFound();
  }

  // Load members
  const { data: memberRows } = await supabase
    .from('trip_members')
    .select('id, user_id, display_name, left_at')
    .eq('trip_id', tripId)
    .is('left_at', null);

  if (!memberRows) {
    notFound();
  }

  const members = memberRows.map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }));

  const currentMember = memberRows.find((m) => m.user_id === user?.id);

  return (
    <div className="max-w-form mx-auto py-6">
      <div className="border-b border-rule pb-3 mb-6">
        <Link
          href={`/trips/${tripId}`}
          className="text-xs text-ink-2 hover:text-ink transition-colors block mb-2"
        >
          ← Back to trip
        </Link>
        <h1 className="font-serif text-3xl font-normal text-ink">
          Edit expense
        </h1>
        <p className="text-xs text-ink-2 mt-1">
          Modify details or adjust split distribution.
        </p>
      </div>

      <div className="border border-rule p-6 bg-paper">
        <ExpenseForm
          tripId={tripId}
          members={members}
          currentMemberId={currentMember?.id}
          initialData={{
            id: expense.id,
            title: expense.title,
            amountRupees: (expense.amount_paise / 100).toString(),
            category: expense.category as ExpenseCategory,
            paidBy: expense.paid_by,
            spentOn: expense.spent_on,
            note: expense.note || '',
            splitType: expense.split_type as SplitType,
            splitInput: (expense.split_input as Record<string, any>) || {},
            version: expense.version,
          }}
        />
      </div>
    </div>
  );
}
