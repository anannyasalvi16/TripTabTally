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

  if (!memberRows || memberRows.length === 0) {
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
          families={families}
          currentMemberId={currentMember?.id}
          startDate={trip?.start_date}
          endDate={trip?.end_date}
        />
      </div>
    </div>
  );
}
