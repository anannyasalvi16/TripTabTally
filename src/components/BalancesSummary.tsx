import { formatPaise } from '@/lib/money';

interface MemberBalance {
  id: string;
  display_name: string;
  netPaise: number;
}

interface BalancesSummaryProps {
  balances: MemberBalance[];
}

export function BalancesSummary({ balances }: BalancesSummaryProps) {
  const allEven = balances.every((b) => b.netPaise === 0);

  return (
    <div className="border border-rule p-4 bg-paper space-y-3">
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <h2 className="font-serif text-lg font-normal text-ink">
          Group balances
        </h2>
        <span className="text-xs text-ink-2">Net position</span>
      </div>

      {allEven ? (
        <p className="text-xs text-ink-2 py-2">Everyone is even</p>
      ) : (
        <div className="divide-y divide-rule text-xs">
          {balances.map((b) => {
            const isOwed = b.netPaise > 0;
            const owes = b.netPaise < 0;
            return (
              <div key={b.id} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-ink font-medium">{b.display_name}</span>
                  {owes && (
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border border-brick text-brick">
                      Pending dues
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {isOwed && (
                    <span className="font-mono tabular-numbers text-moss font-medium">
                      gets back {formatPaise(b.netPaise)}
                    </span>
                  )}
                  {owes && (
                    <span className="font-mono tabular-numbers text-brick font-medium">
                      owes {formatPaise(Math.abs(b.netPaise))}
                    </span>
                  )}
                  {!isOwed && !owes && (
                    <span className="text-ink-2">even</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
