import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface TripItem {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_paise: number | null;
  currency: string;
  archived_at: string | null;
  created_at: string;
  role: string;
}

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load trips where current user is an active member
  const { data: memberRows } = await supabase
    .from('trip_members')
    .select(`
      role,
      left_at,
      trip:trips (
        id,
        name,
        destination,
        start_date,
        end_date,
        budget_paise,
        currency,
        archived_at,
        created_at
      )
    `)
    .eq('user_id', user?.id)
    .is('left_at', null);

  const trips: TripItem[] = (memberRows || []).flatMap((row) => {
    const tripData = row.trip as unknown as Omit<TripItem, 'role'> | null;
    if (!tripData) return [];
    return [{ ...tripData, role: row.role }];
  });

  const activeTrips = trips.filter((t) => !t.archived_at);
  const archivedTrips = trips.filter((t) => Boolean(t.archived_at));

  return (
    <div className="px-4 py-8 sm:px-8 max-w-ledger mx-auto">
      <div className="flex items-center justify-between border-b border-rule pb-4">
        <div>
          <h1 className="font-serif text-3xl font-normal text-ink">
            Your trips
          </h1>
          <p className="mt-1 text-xs text-ink-2">
            Select a trip to record expenses and view balances.
          </p>
        </div>
        <Link
          href="/trips/new"
          className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
        >
          New trip
        </Link>
      </div>

      {activeTrips.length === 0 && archivedTrips.length === 0 ? (
        <div className="py-16 text-center border-b border-rule">
          <p className="text-sm text-ink-2">
            You have no trips. Start one and send the link to your group.
          </p>
          <div className="mt-4">
            <Link
              href="/trips/new"
              className="inline-block bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
            >
              Create first trip
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <div>
            <h2 className="font-serif text-lg font-normal text-ink mb-3">
              Active trips ({activeTrips.length})
            </h2>
            {activeTrips.length === 0 ? (
              <p className="text-xs text-ink-2 py-4 border-t border-rule">
                No active trips.
              </p>
            ) : (
              <div className="border-t border-rule divide-y divide-rule">
                {activeTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="block py-4 px-2 hover:bg-paper-2 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <span className="font-medium text-ink text-base">
                          {trip.name}
                        </span>
                        {trip.destination && (
                          <span className="text-xs text-ink-2 ml-2">
                            ({trip.destination})
                          </span>
                        )}
                        <div className="text-xs text-ink-2 mt-0.5">
                          {trip.start_date ? (
                            <span>
                              {trip.start_date}
                              {trip.end_date ? ` to ${trip.end_date}` : ''}
                            </span>
                          ) : (
                            <span>Dates not set</span>
                          )}
                          <span className="mx-2">•</span>
                          <span className="capitalize">{trip.role}</span>
                        </div>
                      </div>
                      <div className="text-right sm:text-right">
                        {trip.budget_paise ? (
                          <span className="font-mono text-sm tabular-numbers text-ink block">
                            Budget: ₹{(trip.budget_paise / 100).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-2 block">No budget set</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {archivedTrips.length > 0 && (
            <div>
              <h2 className="font-serif text-lg font-normal text-ink-2 mb-3">
                Archived trips ({archivedTrips.length})
              </h2>
              <div className="border-t border-rule divide-y divide-rule opacity-80">
                {archivedTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="block py-3 px-2 hover:bg-paper-2 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink line-through">{trip.name}</span>
                      <span className="text-xs text-ink-2">Archived</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
