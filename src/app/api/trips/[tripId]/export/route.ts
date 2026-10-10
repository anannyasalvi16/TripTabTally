import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ tripId: string }>;
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  const { tripId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check membership
  const { data: member } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Fetch trip
  const { data: trip } = await supabase
    .from('trips')
    .select('name')
    .eq('id', tripId)
    .single();

  const tripName = trip?.name || 'Trip';

  // Fetch members map
  const { data: members } = await supabase
    .from('trip_members')
    .select('id, display_name')
    .eq('trip_id', tripId);

  const memberMap = new Map<string, string>();
  for (const m of members || []) {
    memberMap.set(m.id, m.display_name);
  }

  // Fetch non-deleted expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('title, amount_paise, category, paid_by, spent_on, split_type, note')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('spent_on', { ascending: true });

  // Fetch non-voided settlements
  const { data: settlements } = await supabase
    .from('settlements')
    .select('from_member, to_member, amount_paise, paid_on, note')
    .eq('trip_id', tripId)
    .is('voided_at', null)
    .order('paid_on', { ascending: true });

  // Build CSV lines
  const lines: string[] = [];

  lines.push(`Trip: ${escapeCsv(tripName)}`);
  lines.push(`Exported at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('EXPENSES');
  lines.push('Date,Title,Category,Amount (INR),Paid By,Split Type,Note');

  for (const exp of expenses || []) {
    const date = exp.spent_on;
    const title = exp.title;
    const category = exp.category;
    const amountRupees = (Number(exp.amount_paise) / 100).toFixed(2);
    const paidBy = memberMap.get(exp.paid_by) || 'Member';
    const splitType = exp.split_type;
    const note = exp.note || '';

    lines.push(
      [
        escapeCsv(date),
        escapeCsv(title),
        escapeCsv(category),
        escapeCsv(amountRupees),
        escapeCsv(paidBy),
        escapeCsv(splitType),
        escapeCsv(note),
      ].join(',')
    );
  }

  lines.push('');
  lines.push('SETTLEMENTS');
  lines.push('Date,Paid By,Received By,Amount (INR),Note');

  for (const set of settlements || []) {
    const date = set.paid_on;
    const paidBy = memberMap.get(set.from_member) || 'Member';
    const receivedBy = memberMap.get(set.to_member) || 'Member';
    const amountRupees = (Number(set.amount_paise) / 100).toFixed(2);
    const note = set.note || '';

    lines.push(
      [
        escapeCsv(date),
        escapeCsv(paidBy),
        escapeCsv(receivedBy),
        escapeCsv(amountRupees),
        escapeCsv(note),
      ].join(',')
    );
  }

  const csvContent = lines.join('\r\n');
  const sanitizedName = tripName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="triptabtally-${sanitizedName}-export.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
