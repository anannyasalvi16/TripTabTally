import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface TripPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function TripOverviewPage({ params }: TripPageProps) {
  const { tripId } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from('trips')
    .select('name, budget_paise')
    .eq('id', tripId)
    .single();

  const { data: members } = await supabase
    .from('trip_members')
    .select('id, display_name, role, user_id, left_at')
    .eq('trip_id', tripId);

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, title, amount_paise, spent_on, category, paid_by')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('spent_on', { ascending: false });

  const totalSpentPaise = (expenses || []).reduce((acc, e) => acc + Number(e.amount_paise), 0);
  const activeMembers = (members || []).filter((m) => !m.left_at);

  return (
    <div className="space-y-8">
      {/* Budget Summary Bar */}
      <div className="border border-rule p-4 bg-paper">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-ink-2 gap-2">
          <div>
            <span className="font-mono text-ink text-sm tabular-numbers">
              ₹{(totalSpentPaise / 100).toLocaleString('en-IN')}
            </span>{' '}
            spent
            {trip?.budget_paise && (
              <span>
                {' '}
                of ₹{(trip.budget_paise / 100).toLocaleString('en-IN')} budget
              </span>
            )}
          </div>
          <div>
            <span>{activeMembers.length} members on trip</span>
          </div>
        </div>
      </div>

      {/* Expenses & Actions */}
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <h2 className="font-serif text-xl font-normal text-ink">
          Expenses ({expenses?.length || 0})
        </h2>
        <Link
          href={`/trips/${tripId}/expenses/new`}
          className="text-xs text-brick hover:underline font-medium"
        >
          + Add expense
        </Link>
      </div>

      {!expenses || expenses.length === 0 ? (
        <div className="py-12 text-center border-b border-rule">
          <p className="text-sm text-ink-2">
            No expenses yet. The first one is usually the hotel or the cab.
          </p>
          <div className="mt-4">
            <Link
              href={`/trips/${tripId}/expenses/new`}
              className="inline-block bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
            >
              Add first expense
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-t border-rule divide-y divide-rule">
          {expenses.map((expense) => (
            <div key={expense.id} className="py-3 flex justify-between items-center text-sm">
              <div>
                <p className="font-medium text-ink">{expense.title}</p>
                <p className="text-xs text-ink-2">{expense.spent_on} • {expense.category}</p>
              </div>
              <div className="text-right">
                <span className="font-mono tabular-numbers text-ink">
                  ₹{(expense.amount_paise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
