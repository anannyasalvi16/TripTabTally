import { createClient } from '@/lib/supabase/server';

interface BudgetPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function BudgetPage({ params }: BudgetPageProps) {
  const { tripId } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from('trips')
    .select('name, budget_paise')
    .eq('id', tripId)
    .single();

  const { data: limits } = await supabase
    .from('category_limits')
    .select('category, limit_paise')
    .eq('trip_id', tripId);

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-2">
        <h2 className="font-serif text-2xl font-normal text-ink">
          Trip budget
        </h2>
        <p className="text-xs text-ink-2 mt-1">
          Track overall spending and category limits.
        </p>
      </div>

      <div className="border border-rule p-4 bg-paper">
        <h3 className="text-xs font-mono uppercase text-ink-2 mb-1">Total budget</h3>
        <p className="font-serif text-2xl text-ink">
          {trip?.budget_paise
            ? `₹${(trip.budget_paise / 100).toLocaleString('en-IN')}`
            : 'No total budget set'}
        </p>
      </div>

      <div>
        <h3 className="font-serif text-lg font-normal text-ink mb-3">
          Category limits
        </h3>
        {!limits || limits.length === 0 ? (
          <p className="text-xs text-ink-2 py-4 border-t border-rule">
            No category limits set for this trip.
          </p>
        ) : (
          <div className="border-t border-rule divide-y divide-rule">
            {limits.map((l) => (
              <div key={l.category} className="py-2.5 flex justify-between text-sm">
                <span className="capitalize text-ink">{l.category}</span>
                <span className="font-mono tabular-numbers text-ink">
                  ₹{(l.limit_paise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
