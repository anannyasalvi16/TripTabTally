import { createClient } from '@/lib/supabase/server';

interface SettlePageProps {
  params: Promise<{ tripId: string }>;
}

export default async function SettlePage({ params }: SettlePageProps) {
  const { tripId } = await params;
  const supabase = await createClient();

  const { data: settlements } = await supabase
    .from('settlements')
    .select(`
      id,
      amount_paise,
      paid_on,
      note,
      from_member_data:from_member(display_name),
      to_member_data:to_member(display_name)
    `)
    .eq('trip_id', tripId)
    .is('voided_at', null)
    .order('paid_on', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-2">
        <h2 className="font-serif text-2xl font-normal text-ink">
          Settle up
        </h2>
        <p className="text-xs text-ink-2 mt-1">
          Debt settlement plan and recorded payments.
        </p>
      </div>

      <div>
        <h3 className="font-serif text-lg font-normal text-ink mb-3">
          Recorded settlements ({settlements?.length || 0})
        </h3>
        {!settlements || settlements.length === 0 ? (
          <p className="text-xs text-ink-2 py-4 border-t border-rule">
            No payments recorded yet.
          </p>
        ) : (
          <div className="border-t border-rule divide-y divide-rule text-sm">
            {settlements.map((s) => {
              const fromName =
                (s.from_member_data as unknown as { display_name?: string })?.display_name || 'Member';
              const toName =
                (s.to_member_data as unknown as { display_name?: string })?.display_name || 'Member';
              return (
                <div key={s.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-ink font-medium">
                      {fromName} paid {toName}
                    </p>
                    <p className="text-xs text-ink-2">
                      {s.paid_on}
                      {s.note ? ` • ${s.note}` : ''}
                    </p>
                  </div>
                  <span className="font-mono tabular-numbers text-moss font-medium">
                    ₹{(s.amount_paise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
