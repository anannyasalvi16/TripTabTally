import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { JoinClientView } from './JoinClientView';

interface JoinPageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // Validate invite token
  const { data: invite } = await supabase
    .from('invites')
    .select(`
      token,
      expires_at,
      revoked_at,
      trip:trips (
        id,
        name,
        destination,
        archived_at
      )
    `)
    .eq('token', token)
    .single();

  const isInvalid =
    !invite ||
    Boolean(invite.revoked_at) ||
    new Date(invite.expires_at) < new Date() ||
    !invite.trip;

  if (isInvalid) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12">
        <div className="max-w-form w-full border border-rule p-8 bg-paper">
          <span className="font-mono text-xs text-brick block mb-2">Invite inactive</span>
          <h1 className="font-serif text-2xl font-normal text-ink">
            Invite link not available
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            This invite link is no longer active. Ask the trip admin for a new one.
          </p>
          <div className="mt-6">
            <Link
              href="/trips"
              className="inline-block bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
            >
              Go to your trips
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const trip = invite.trip as unknown as {
    id: string;
    name: string;
    destination: string | null;
    archived_at: string | null;
  };

  // Get current session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load all trip members
  const { data: memberRows } = await supabase
    .from('trip_members')
    .select('id, user_id, display_name, left_at')
    .eq('trip_id', trip.id)
    .is('left_at', null);

  const members = (memberRows || []).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    isPlaceholder: m.user_id === null,
  }));

  const placeholders = members.filter((m) => m.isPlaceholder);
  const claimedMembers = members.filter((m) => !m.isPlaceholder);

  const isAlreadyMember = Boolean(user && memberRows?.some((m) => m.user_id === user.id));

  let defaultDisplayName = '';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();
    defaultDisplayName = profile?.display_name || user.email?.split('@')[0] || '';
  }

  return (
    <JoinClientView
      token={token}
      tripName={trip.name}
      destination={trip.destination}
      members={claimedMembers}
      placeholders={placeholders}
      isSignedIn={Boolean(user)}
      isAlreadyMember={isAlreadyMember}
      tripId={trip.id}
      defaultDisplayName={defaultDisplayName}
    />
  );
}
