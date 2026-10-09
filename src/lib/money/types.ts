export type Paise = number; // Integer representing amount in paise (1 INR = 100 paise)

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; differencePaise?: Paise };

export interface MemberBalanceInput {
  id: string;
}

export interface ExpenseBalanceInput {
  id: string;
  paid_by: string;
  amount_paise: Paise;
  deleted_at?: string | null;
}

export interface SplitBalanceInput {
  expense_id: string;
  member_id: string;
  share_paise: Paise;
}

export interface SettlementBalanceInput {
  id: string;
  from_member: string;
  to_member: string;
  amount_paise: Paise;
  voided_at?: string | null;
}

export interface TransferPlan {
  from: string;
  to: string;
  amount: Paise;
}
