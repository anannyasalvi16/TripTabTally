import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeBalances, planSettlement } from '@/lib/money';
import {
  SettleClientView,
  type MemberInfo,
  type PlannedPayment,
  type RecordedSettlement,
} from './SettleClientView';

interface SettlePageProps {
  params: Promise<{ tripId: string }>;
}

export default async function SettlePage({ params }: SettlePageProps) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Check membership
  const { data: currentMember } = await supabase
    .from('trip_members')
    .select('id, role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!currentMember) {
    notFound();
  }

  // Fetch trip
  const { data: trip } = await supabase
    .from('trips')
    .select('id, name')
    .eq('id', tripId)
    .single();

  if (!trip) {
    notFound();
  }

  // Fetch all members with user profiles (for upi_id)
  const { data: rawMembers } = await supabase
    .from('trip_members')
    .select(`
      id,
      display_name,
      role,
      user_id,
      profiles:user_id (
        upi_id
      )
    `)
    .eq('trip_id', tripId);

  const members: MemberInfo[] = (rawMembers || []).map((m) => {
    const profile = m.profiles as unknown as { upi_id?: string | null } | null;
    return {
      id: m.id,
      displayName: m.display_name,
      upiId: profile?.upi_id || null,
    };
  });

  const memberMap = new Map<string, MemberInfo>();
  for (const m of members) {
    memberMap.set(m.id, m);
  }

  // Fetch non-deleted expenses
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('id, paid_by, amount_paise, deleted_at')
    .eq('trip_id', tripId)
    .is('deleted_at', null);

  const expenses = (rawExpenses || []).map((e) => ({
    id: e.id,
    paid_by: e.paid_by,
    amount_paise: Number(e.amount_paise),
    deleted_at: null,
  }));

  // Fetch splits for those expenses
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

  // Fetch non-voided settlements
  const { data: rawSettlements } = await supabase
    .from('settlements')
    .select(`
      id,
      from_member,
      to_member,
      amount_paise,
      paid_on,
      note,
      created_by,
      voided_at
    `)
    .eq('trip_id', tripId)
    .is('voided_at', null)
    .order('paid_on', { ascending: false });

  const settlements = (rawSettlements || []).map((s) => ({
    id: s.id,
    from_member: s.from_member,
    to_member: s.to_member,
    amount_paise: Number(s.amount_paise),
    voided_at: null,
  }));

  // Compute balances
  const balances = computeBalances(
    members.map((m) => ({ id: m.id })),
    expenses,
    splits,
    settlements
  );

  // Compute settlement plan
  let plannedTransfers: PlannedPayment[] = [];
  try {
    const plan = planSettlement(balances);
    plannedTransfers = plan.map((p) => {
      const fromMem = memberMap.get(p.from);
      const toMem = memberMap.get(p.to);
      return {
        fromId: p.from,
        fromName: fromMem?.displayName || 'Member',
        toId: p.to,
        toName: toMem?.displayName || 'Member',
        toUpiId: toMem?.upiId || null,
        amountPaise: p.amount,
      };
    });
  } catch {
    // If balances do not sum to zero (e.g. edge condition), leave plan empty
    plannedTransfers = [];
  }

  const isAllSettled =
    Object.values(balances).every((b) => b === 0) && expenses.length > 0;

  const recordedSettlements: RecordedSettlement[] = (rawSettlements || []).map((s) => ({
    id: s.id,
    fromId: s.from_member,
    fromName: memberMap.get(s.from_member)?.displayName || 'Member',
    toId: s.to_member,
    toName: memberMap.get(s.to_member)?.displayName || 'Member',
    amountPaise: Number(s.amount_paise),
    paidOn: s.paid_on,
    note: s.note,
    createdBy: s.created_by,
  }));

  return (
    <SettleClientView
      tripId={tripId}
      tripName={trip.name}
      members={members}
      currentMemberId={currentMember.id}
      isAdmin={currentMember.role === 'admin'}
      plannedTransfers={plannedTransfers}
      recordedSettlements={recordedSettlements}
      isAllSettled={isAllSettled}
    />
  );
}
