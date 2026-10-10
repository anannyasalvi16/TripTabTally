import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

interface TripLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tripId: string }>;
}): Promise<Metadata> {
  const { tripId } = await params;
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('name, destination')
    .eq('id', tripId)
    .single();

  if (!trip) {
    return { title: 'Trip' };
  }

  const titlePrefix = trip.destination ? `${trip.name}, ${trip.destination}` : trip.name;
  return {
    title: `${titlePrefix} | TripTabTally`,
  };
}

export default async function TripLayout({ children, params }: TripLayoutProps) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Load member status (FR-291: 404 if not a member, do not leak trip existence)
  const { data: member } = await supabase
    .from('trip_members')
    .select('id, role, display_name')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .single();

  if (!member) {
    notFound();
  }

  // Load trip details
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (!trip) {
    notFound();
  }

  const tabs = [
    { label: 'Expenses', href: `/trips/${tripId}` },
    { label: 'People', href: `/trips/${tripId}/people` },
    { label: 'Budget', href: `/trips/${tripId}/budget` },
    { label: 'Settle up', href: `/trips/${tripId}/settle` },
  ];

  return (
    <div>
      <div className="border-b border-rule bg-paper">
        <div className="max-w-ledger mx-auto px-4 py-6 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-ink-2 uppercase tracking-wider">
                  Trip
                </span>
                {trip.archived_at && (
                  <span className="text-xs bg-paper-2 border border-rule px-1.5 py-0.5 text-ink-2">
                    Archived
                  </span>
                )}
                <span className="text-xs text-ink-2">•</span>
                <span className="text-xs text-ink-2 capitalize">
                  {member.role} ({member.display_name})
                </span>
              </div>
              <h1 className="font-serif text-3xl font-normal text-ink mt-1">
                {trip.name}
              </h1>
              <div className="text-xs text-ink-2 mt-1">
                {trip.destination && <span>{trip.destination}</span>}
                {trip.destination && trip.start_date && <span> • </span>}
                {trip.start_date && (
                  <span>
                    {trip.start_date}
                    {trip.end_date ? ` to ${trip.end_date}` : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 sm:pt-0">
              <Link
                href={`/trips/${tripId}/expenses/new`}
                className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
              >
                Add expense
              </Link>
            </div>
          </div>

          <nav aria-label="Trip tabs navigation" className="flex space-x-6 mt-6 border-b border-rule -mb-px text-sm">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="pb-3 text-ink hover:text-brick transition-colors border-b-2 border-transparent hover:border-brick"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-ledger mx-auto px-4 py-6 sm:px-8">
        {children}
      </div>
    </div>
  );
}
