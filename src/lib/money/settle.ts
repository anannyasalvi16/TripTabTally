import type { Paise, TransferPlan } from './types';
import { verifyZeroSum } from './balances';

/**
 * Greedy debt simplification algorithm:
 * Matches the person who is owed the most (top creditor) with the person
 * who owes the most (top debtor), transferring the minimum of the two amounts.
 *
 * Guarantees at most (non-zero members - 1) transfers and settles all balances to zero.
 */
export function planSettlement(balances: Record<string, Paise>): TransferPlan[] {
  const sum = Object.values(balances).reduce((acc, b) => acc + b, 0);
  if (sum !== 0) {
    throw new Error(`Balances do not sum to zero. Net sum is ${sum} paise.`);
  }

  // Debtors have negative balance (they owe money)
  // Creditors have positive balance (they are owed money)
  const debtors: Array<{ id: string; amount: Paise }> = [];
  const creditors: Array<{ id: string; amount: Paise }> = [];

  for (const [id, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance);
    if (rounded < 0) {
      debtors.push({ id, amount: Math.abs(rounded) });
    } else if (rounded > 0) {
      creditors.push({ id, amount: rounded });
    }
  }

  const transfers: TransferPlan[] = [];

  // Sort descending by amount initially
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (!debtor || !creditor) break;

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0) {
      transfers.push({
        from: debtor.id,
        to: creditor.id,
        amount: transferAmount,
      });

      debtor.amount -= transferAmount;
      creditor.amount -= transferAmount;
    }

    if (debtor.amount === 0) {
      dIdx++;
    }

    if (creditor.amount === 0) {
      cIdx++;
    }
  }

  return transfers;
}

/**
 * Applies a transfer plan as simulated settlements to verify that all balances reach zero.
 */
export function applySettlementPlan(
  balances: Record<string, Paise>,
  transfers: TransferPlan[]
): Record<string, Paise> {
  const result: Record<string, Paise> = { ...balances };

  for (const t of transfers) {
    // Debtor pays transfer: increases their net balance towards zero
    result[t.from] = (result[t.from] || 0) + t.amount;
    // Creditor receives transfer: decreases their net balance towards zero
    result[t.to] = (result[t.to] || 0) - t.amount;
  }

  return result;
}
