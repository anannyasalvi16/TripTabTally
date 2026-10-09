import type {
  Paise,
  MemberBalanceInput,
  ExpenseBalanceInput,
  SplitBalanceInput,
  SettlementBalanceInput,
} from './types';

/**
 * Computes the net balance for each member in a trip.
 * Net balance = paid for expenses - owed in shares + settlements paid - settlements received.
 *
 * Invariant: The sum of all net balances in a trip must always equal zero.
 */
export function computeBalances(
  members: MemberBalanceInput[],
  expenses: ExpenseBalanceInput[],
  splits: SplitBalanceInput[],
  settlements: SettlementBalanceInput[]
): Record<string, Paise> {
  const balances: Record<string, Paise> = {};

  // Initialize all members with zero balance
  for (const m of members) {
    balances[m.id] = 0;
  }

  // Filter active expenses
  const activeExpenseMap = new Map<string, ExpenseBalanceInput>();
  for (const e of expenses) {
    if (!e.deleted_at) {
      activeExpenseMap.set(e.id, e);
      // Credit the payer
      balances[e.paid_by] = (balances[e.paid_by] || 0) + e.amount_paise;
    }
  }

  // Deduct each member's share for active expenses
  for (const s of splits) {
    if (activeExpenseMap.has(s.expense_id)) {
      balances[s.member_id] = (balances[s.member_id] || 0) - s.share_paise;
    }
  }

  // Account for non-voided settlements
  for (const st of settlements) {
    if (!st.voided_at) {
      // Payer settled a debt (+amount towards their net balance)
      balances[st.from_member] = (balances[st.from_member] || 0) + st.amount_paise;
      // Receiver collected money (-amount towards their net balance)
      balances[st.to_member] = (balances[st.to_member] || 0) - st.amount_paise;
    }
  }

  return balances;
}

/**
 * Verifies the zero-sum invariant across balances.
 */
export function verifyZeroSum(balances: Record<string, Paise>): boolean {
  const sum = Object.values(balances).reduce((acc, b) => acc + b, 0);
  return sum === 0;
}
