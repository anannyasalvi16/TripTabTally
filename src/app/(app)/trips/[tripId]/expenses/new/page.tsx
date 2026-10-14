import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ExpenseForm } from '@/components/ExpenseForm';

interface NewExpensePageProps {
  params: Promise<{ tripId: string }>;
}

export default async function NewExpensePage({ params }: NewExpensePageProps) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load members
  const { data: memberRows } = await supabase
    .from('trip_members')
    .select('id, user_id, display_name, left_at')
    .eq('trip_id', tripId)
    .is('left_at', null);

  if (!memberRows || memberRows.length === 0) {
    notFound();
  }

  const members = memberRows.map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }));

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
          Add expense
        </h1>
        <p className="text-xs text-ink-2 mt-1">
          Record a shared cost for this trip.
        </p>
      </div>

      <div className="border border-rule p-6 bg-paper">
        <ExpenseForm
          tripId={tripId}
          members={members}
          currentMemberId={currentMember?.id}
          startDate={trip?.start_date}
          endDate={trip?.end_date}
        />
      </div>
    </div>
  );
}
