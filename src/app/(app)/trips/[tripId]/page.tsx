import { createClient } from '@/lib/supabase/server';
import { computeBalances } from '@/lib/money';
import { TripMainView } from './TripMainView';

interface TripPageProps {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{
    category?: string;
    payer?: string;
    sort?: string;
  }>;
}

export default async function TripOverviewPage({ params, searchParams }: TripPageProps) {
  const { tripId } = await params;
  const { category, payer, sort = 'date_desc' } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load trip details
  const { data: trip } = await supabase
    .from('trips')
    .select('name, budget_paise, start_date, end_date')
    .eq('id', tripId)
    .single();

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
    .select('id, user_id, display_name, role, left_at, family_id, trip_families(id, name)')
    .eq('trip_id', tripId)
    .is('left_at', null);

  const members = (memberRows || []).map((m) => {
    const fam = m.trip_families as unknown as { id: string; name: string } | null;
    return {
      id: m.id,
      display_name: m.display_name,
      family_id: m.family_id,
      family_name: fam?.name || null,
    };
  });

  const currentMember = (memberRows || []).find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin';

  // Build filtered expenses query
  let expenseQuery = supabase
    .from('expenses')
    .select(`
      id,
      title,
      amount_paise,
      category,
      paid_by,
      spent_on,
      split_type,
      split_input,
      note,
      created_by,
      version,
      recurring_rule_id,
      recurring_sequence,
      payer:paid_by (display_name),
      splits:expense_splits (count)
    `)
    .eq('trip_id', tripId)
    .is('deleted_at', null);

  if (category) {
    expenseQuery = expenseQuery.eq('category', category);
  }

  if (payer) {
    expenseQuery = expenseQuery.eq('paid_by', payer);
  }

  // Apply sort order
  if (sort === 'date_asc') {
    expenseQuery = expenseQuery.order('spent_on', { ascending: true });
  } else if (sort === 'amount_desc') {
    expenseQuery = expenseQuery.order('amount_paise', { ascending: false });
  } else if (sort === 'amount_asc') {
    expenseQuery = expenseQuery.order('amount_paise', { ascending: true });
  } else {
    // Default: date_desc
    expenseQuery = expenseQuery.order('spent_on', { ascending: false });
  }

  const { data: expenseRows } = await expenseQuery;

  // Load all non-deleted expenses, splits, and non-voided settlements for global balance computation
  const { data: allExpenses } = await supabase
    .from('expenses')
    .select('id, paid_by, amount_paise, deleted_at')
    .eq('trip_id', tripId)
    .is('deleted_at', null);

  const { data: allSplits } = await supabase
    .from('expense_splits')
    .select('expense_id, member_id, share_paise')
    .in('expense_id', (allExpenses || []).map((e) => e.id));

  const { data: allSettlements } = await supabase
    .from('settlements')
    .select('id, from_member, to_member, amount_paise, voided_at')
    .eq('trip_id', tripId)
    .is('voided_at', null);

  const rawBalances = computeBalances(
    members,
    allExpenses || [],
    allSplits || [],
    allSettlements || []
  );

  const balances = members.map((m) => ({
    id: m.id,
    display_name: m.display_name,
    netPaise: rawBalances[m.id] || 0,
  }));

  const expenses = (expenseRows || []).map((e) => {
    const payerObj = e.payer as unknown as { display_name?: string } | null;
    const splitCountObj = e.splits as unknown as Array<{ count?: number }> | null;
    return {
      id: e.id,
      title: e.title,
      amount_paise: Number(e.amount_paise),
      category: e.category,
      paid_by: e.paid_by,
      spent_on: e.spent_on,
      split_type: e.split_type,
      split_input: e.split_input as Record<string, any>,
      note: e.note,
      created_by: e.created_by,
      version: e.version,
      recurring_rule_id: (e as any).recurring_rule_id || null,
      recurring_sequence: (e as any).recurring_sequence || null,
      payerName: payerObj?.display_name || 'Member',
      splitsCount: splitCountObj?.[0]?.count ?? 0,
    };
  });

  const allTotalSpentPaise = (allExpenses || []).reduce(
    (acc, e) => acc + Number(e.amount_paise),
    0
  );

  return (
    <TripMainView
      tripId={tripId}
      totalBudgetPaise={trip?.budget_paise || null}
      allTotalSpentPaise={allTotalSpentPaise}
      startDate={trip?.start_date}
      endDate={trip?.end_date}
      members={members}
      families={families}
      expenses={expenses}
      balances={balances}
      isAdmin={isAdmin}
      currentMemberId={currentMember?.id}
    />
  );
}
