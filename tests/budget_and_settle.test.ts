import { describe, it, expect } from 'vitest';
import { updateBudgetSchema, updateCategoryLimitSchema } from '@/lib/schemas/budget';
import { settlementSchema } from '@/lib/schemas/settlement';
import { computeBalances, planSettlement } from '@/lib/money';

describe('Budget Schemas Validation', () => {
  it('validates valid trip total budget', () => {
    const valid = updateBudgetSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      budgetRupees: '50000',
    });
    expect(valid.success).toBe(true);
  });

  it('allows empty budget to clear budget', () => {
    const valid = updateBudgetSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      budgetRupees: '',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid budget amounts', () => {
    const invalid = updateBudgetSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      budgetRupees: 'invalid-amount',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates category limit update for allowed category', () => {
    const valid = updateCategoryLimitSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      category: 'food',
      limitRupees: '12000.50',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid category', () => {
    const invalid = updateCategoryLimitSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      category: 'entertainment', // not in allowed categories
      limitRupees: '1000',
    });
    expect(invalid.success).toBe(false);
  });
});

describe('Settlement Schema Validation', () => {
  it('validates valid settlement between two distinct members', () => {
    const valid = settlementSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      fromMember: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      toMember: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      amountRupees: '1500.00',
      paidOn: '2026-10-10',
      note: 'UPI transfer for dinner',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects settlement where payer and receiver are the same person', () => {
    const invalid = settlementSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      fromMember: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      toMember: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', // Same person
      amountRupees: '1500.00',
      paidOn: '2026-10-10',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toContain(
        'Payer and receiver must be different members'
      );
    }
  });

  it('rejects negative or invalid amount format', () => {
    const invalid = settlementSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      fromMember: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      toMember: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      amountRupees: '-500',
    });
    expect(invalid.success).toBe(false);
  });
});

describe('End-to-End Settlement Flow Invariant', () => {
  it('clears all debts to zero once planned transfers are recorded as settlements', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];

    // Expenses:
    // m1 paid 30000 paise (Rs 300) split equally among m1, m2, m3 (10000 each)
    // m2 paid 0
    // m3 paid 0
    const expenses = [
      { id: 'e1', paid_by: 'm1', amount_paise: 30000, deleted_at: null },
    ];
    const splits = [
      { expense_id: 'e1', member_id: 'm1', share_paise: 10000 },
      { expense_id: 'e1', member_id: 'm2', share_paise: 10000 },
      { expense_id: 'e1', member_id: 'm3', share_paise: 10000 },
    ];

    // Initial balances before any settlements
    const initialBalances = computeBalances(members, expenses, splits, []);
    expect(initialBalances.m1).toBe(20000); // m1 gets back 200
    expect(initialBalances.m2).toBe(-10000); // m2 owes 100
    expect(initialBalances.m3).toBe(-10000); // m3 owes 100

    // Generate settlement plan
    const plan = planSettlement(initialBalances);
    expect(plan.length).toBe(2);

    // Turn plan into recorded settlements
    const recordedSettlements = plan.map((p, idx) => ({
      id: `s${idx}`,
      from_member: p.from,
      to_member: p.to,
      amount_paise: p.amount,
      voided_at: null,
    }));

    // Recompute balances with settlements applied
    const finalBalances = computeBalances(
      members,
      expenses,
      splits,
      recordedSettlements
    );

    expect(finalBalances.m1).toBe(0);
    expect(finalBalances.m2).toBe(0);
    expect(finalBalances.m3).toBe(0);
  });
});
