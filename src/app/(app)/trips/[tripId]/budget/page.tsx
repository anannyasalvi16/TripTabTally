import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { expenseCategories, type ExpenseCategory } from '@/lib/schemas/expense';
import { generateInsights, getDaysCount } from '@/lib/insights';
import { BudgetClientView } from './BudgetClientView';

interface BudgetPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function BudgetPage({ params }: BudgetPageProps) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Check membership and role
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    notFound();
  }

  const isAdmin = member.role === 'admin';

  // Fetch trip
  const { data: trip } = await supabase
    .from('trips')
    .select('id, name, budget_paise, start_date, end_date')
    .eq('id', tripId)
    .single();

  if (!trip) {
    notFound();
  }

  // Fetch category limits
  const { data: rawLimits } = await supabase
    .from('category_limits')
    .select('category, limit_paise')
    .eq('trip_id', tripId);

  const limitsMap = new Map<string, number>();
  for (const l of rawLimits || []) {
    limitsMap.set(l.category, Number(l.limit_paise));
  }

  // Fetch non-deleted expenses
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('id, amount_paise, category, spent_on, paid_by')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('spent_on', { ascending: true });

  // Fetch members for payer insight
  const { data: members } = await supabase
    .from('trip_members')
    .select('id, display_name')
    .eq('trip_id', tripId);

  const memberNameMap = new Map<string, string>();
  const memberPaidMap = new Map<string, number>();
  for (const m of members || []) {
    memberNameMap.set(m.id, m.display_name);
    memberPaidMap.set(m.id, 0);
  }

  // Aggregate category spend
  const categorySpendMap = new Map<ExpenseCategory, number>();
  for (const cat of expenseCategories) {
    categorySpendMap.set(cat, 0);
  }

  // Aggregate daily spend
  const dailySpendMap = new Map<string, number>();

  let totalSpentPaise = 0;

  for (const exp of rawExpenses || []) {
    const amount = Number(exp.amount_paise);
    totalSpentPaise += amount;

    // Category
    const cat = exp.category as ExpenseCategory;
    const currentCatSpend = categorySpendMap.get(cat) || 0;
    categorySpendMap.set(cat, currentCatSpend + amount);

    // Daily
    const date = exp.spent_on;
    const currentDaySpend = dailySpendMap.get(date) || 0;
    dailySpendMap.set(date, currentDaySpend + amount);

    // Member paid
    const currentMemberPaid = memberPaidMap.get(exp.paid_by) || 0;
    memberPaidMap.set(exp.paid_by, currentMemberPaid + amount);
  }

  // Build categories list for HBarChart
  const categoriesData = expenseCategories.map((cat) => ({
    category: cat,
    amountPaise: categorySpendMap.get(cat) || 0,
    limitPaise: limitsMap.get(cat) || null,
  }));

  // Build daily data for BarChart
  const dailyData = Array.from(dailySpendMap.entries())
    .map(([date, amountPaise]) => ({
      date,
      amountPaise,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Planned daily average
  let plannedDailyAveragePaise: number | null = null;
  if (trip.budget_paise && trip.start_date && trip.end_date) {
    const totalDays = getDaysCount(trip.start_date, trip.end_date);
    plannedDailyAveragePaise = Math.round(Number(trip.budget_paise) / totalDays);
  }

  // Member spend list for insights
  const memberSpendList = Array.from(memberPaidMap.entries()).map(([id, paidPaise]) => ({
    displayName: memberNameMap.get(id) || 'Member',
    paidPaise,
  }));

  // Generate template insights
  const insights = generateInsights({
    categories: categoriesData.map((c) => ({
      category: c.category,
      spentPaise: c.amountPaise,
      limitPaise: c.limitPaise,
    })),
    members: memberSpendList,
    pace: {
      totalSpentPaise,
      budgetPaise: trip.budget_paise ? Number(trip.budget_paise) : null,
      startDate: trip.start_date,
      endDate: trip.end_date,
    },
  });

  return (
    <BudgetClientView
      tripId={tripId}
      tripName={trip.name}
      budgetPaise={trip.budget_paise ? Number(trip.budget_paise) : null}
      isAdmin={isAdmin}
      categories={categoriesData}
      dailyData={dailyData}
      plannedDailyAveragePaise={plannedDailyAveragePaise}
      insights={insights}
    />
  );
}
