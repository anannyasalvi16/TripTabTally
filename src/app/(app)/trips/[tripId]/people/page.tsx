import { createClient } from '@/lib/supabase/server';
import { PeopleView } from './PeopleView';

interface PeoplePageProps {
  params: Promise<{ tripId: string }>;
}

export default async function PeoplePage({ params }: PeoplePageProps) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load members and profile UPI details
  const { data: memberRows } = await supabase
    .from('trip_members')
    .select(`
      id,
      user_id,
      display_name,
      role,
      left_at,
      joined_at,
      family_id,
      email,
      phone,
      profiles:user_id (
        upi_id
      )
    `)
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  const currentMember = (memberRows || []).find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin';

  // Load active invite token
  const { data: invite } = await supabase
    .from('invites')
    .select('token')
    .eq('trip_id', tripId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .single();

  // Load families
  const { data: rawFamilies } = await supabase
    .from('trip_families')
    .select('id, name')
    .eq('trip_id', tripId)
    .order('name', { ascending: true });

  const families = (rawFamilies || []).map((f) => ({ id: f.id, name: f.name }));

  const members = (memberRows || []).map((m) => {
    // Cast profiles object
    const profile = m.profiles as unknown as { upi_id?: string | null } | null;
    return {
      id: m.id,
      user_id: m.user_id,
      display_name: m.display_name,
      role: m.role as 'admin' | 'member',
      left_at: m.left_at,
      joined_at: m.joined_at,
      family_id: m.family_id || null,
      email: m.email || null,
      phone: m.phone || null,
      upi_id: profile?.upi_id || null,
    };
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <PeopleView
      tripId={tripId}
      isAdmin={isAdmin}
      currentUserId={user?.id || ''}
      members={members}
      families={families}
      inviteToken={invite?.token || null}
      siteUrl={siteUrl}
    />
  );
}
