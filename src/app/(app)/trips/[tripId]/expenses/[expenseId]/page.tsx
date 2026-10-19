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

  // Load families
  const { data: familyRows } = await supabase
    .from('trip_families')
    .select('id, name')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  const families = (familyRows || []).map((f) => ({
    id: f.id,
    name: f.name,
  }));

  // Load members
  const { data: memberRows } = await supabase
    .from('trip_members')
    .select('id, user_id, display_name, left_at, family_id, trip_families(id, name)')
    .eq('trip_id', tripId)
    .is('left_at', null);

  if (!memberRows) {
    notFound();
  }

  const members = memberRows.map((m) => {
    const fam = m.trip_families as unknown as { id: string; name: string } | null;
    return {
      id: m.id,
      display_name: m.display_name,
      family_id: m.family_id,
      family_name: fam?.name || null,
    };
  });

  const currentMember = memberRows.find((m) => m.user_id === user?.id);

  // Load trip details
  const { data: trip } = await supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', tripId)
    .single();

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
          families={families}
          currentMemberId={currentMember?.id}
          startDate={trip?.start_date}
          endDate={trip?.end_date}
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
