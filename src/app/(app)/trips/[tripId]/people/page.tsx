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
  const { data: rawInvites } = await supabase
    .from('invites')
    .select('token, expires_at')
    .eq('trip_id', tripId)
    .is('revoked_at', null)
    .order('expires_at', { ascending: false });

  const activeInvite = (rawInvites || []).find(
    (inv) => !inv.expires_at || new Date(inv.expires_at) > new Date()
  );

  // Fetch non-deleted expenses for balances
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('id, paid_by, amount_paise')
    .eq('trip_id', tripId)
    .is('deleted_at', null);

  const expenses = (rawExpenses || []).map((e) => ({
    id: e.id,
    paid_by: e.paid_by,
    amount_paise: Number(e.amount_paise),
    deleted_at: null,
  }));

  const expenseIds = expenses.map((e) => e.id);
  let splits: Array<{ expense_id: string; member_id: string; share_paise: number }> = [];
  if (expenseIds.length > 0) {
    const { data: rawSplits } = await supabase
      .from('expense_splits')
      .select('expense_id, member_id, share_paise')
      .in('expense_id', expenseIds);

    splits = (rawSplits || []).map((s) => ({
      expense_id: s.expense_id,
      member_id: s.member_id,
      share_paise: Number(s.share_paise),
    }));
  }

  // Fetch settlements
  const { data: rawSettlements } = await supabase
    .from('settlements')
    .select('id, from_member, to_member, amount_paise')
    .eq('trip_id', tripId)
    .is('voided_at', null);

  const settlements = (rawSettlements || []).map((s) => ({
    id: s.id,
    from_member: s.from_member,
    to_member: s.to_member,
    amount_paise: Number(s.amount_paise),
    voided_at: null,
  }));

  const { computeBalances } = await import('@/lib/money');
  const balances = computeBalances(
    (memberRows || []).map((m) => ({ id: m.id })),
    expenses,
    splits,
    settlements
  );

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
      inviteToken={activeInvite?.token || null}
      inviteExpiresAt={activeInvite?.expires_at || null}
      memberBalances={balances}
      siteUrl={siteUrl}
    />
  );
}
