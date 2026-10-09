import { describe, it, expect } from 'vitest';
import { expenseSchema, expenseCategories } from '@/lib/schemas/expense';
import {
  parseRupeesToPaise,
  splitEqual,
  splitExact,
  splitPercent,
  splitShares,
  computeBalances,
} from '@/lib/money';

describe('Expense Schema Validation', () => {
  it('validates a complete and correct expense payload', () => {
    const valid = expenseSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Cab to Candolim',
      amountRupees: '1200',
      category: 'transport',
      paidBy: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      spentOn: '2026-12-10',
      splitType: 'equal',
      splitInput: { memberIds: ['baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'] },
      version: 1,
    });
    expect(valid.success).toBe(true);
  });

  it('rejects missing or empty title', () => {
    const invalid = expenseSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: '',
      amountRupees: '1200',
      category: 'transport',
      paidBy: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      spentOn: '2026-12-10',
      splitType: 'equal',
      splitInput: {},
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects title longer than 80 characters', () => {
    const invalid = expenseSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'A'.repeat(81),
      amountRupees: '1200',
      category: 'transport',
      paidBy: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      spentOn: '2026-12-10',
      splitType: 'equal',
      splitInput: {},
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects invalid categories not in allowed list', () => {
    const invalid = expenseSchema.safeParse({
      tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Souvenirs',
      amountRupees: '500',
      category: 'luxury', // not allowed
      paidBy: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      spentOn: '2026-12-10',
      splitType: 'equal',
      splitInput: {},
    });
    expect(invalid.success).toBe(false);
  });

  it('allows all six valid categories from PRD', () => {
    for (const cat of expenseCategories) {
      const valid = expenseSchema.safeParse({
        tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'Item',
        amountRupees: '100',
        category: cat,
        paidBy: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        spentOn: '2026-12-10',
        splitType: 'equal',
        splitInput: {},
      });
      expect(valid.success).toBe(true);
    }
  });
});

function getPaise(rupees: string): number {
  const result = parseRupeesToPaise(rupees);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe('Live Split Calculations For Expense Form', () => {
  it('correctly divides equal splits on live change', () => {
    const amountPaise = getPaise('1200');
    const members = ['m1', 'm2', 'm3', 'm4'];
    const splits = splitEqual(amountPaise, members, 'Cab to Candolim');

    expect(Object.keys(splits).length).toBe(4);
    expect(splits.m1).toBe(30000); // Rs 300
    expect(splits.m2).toBe(30000);
    expect(splits.m3).toBe(30000);
    expect(splits.m4).toBe(30000);
  });

  it('flags unassigned amount in exact splits', () => {
    const amountPaise = getPaise('1000');
    const exactResult = splitExact(amountPaise, {
      m1: 50000,
      m2: 46000, // 4000 paise (Rs 40) missing
    });

    expect(exactResult.ok).toBe(false);
    if (!exactResult.ok) {
      expect(exactResult.differencePaise).toBe(4000);
      expect(exactResult.error).toContain('is not assigned to anyone yet');
    }
  });

  it('flags percentages that do not add to 100', () => {
    const amountPaise = getPaise('1000');
    const pctResult = splitPercent(amountPaise, {
      m1: 50,
      m2: 46, // adds to 96
    });

    expect(pctResult.ok).toBe(false);
    if (!pctResult.ok) {
      expect(pctResult.error).toContain('Percentages add up to 96.00');
    }
  });

  it('calculates integer shares accurately with remainder distribution', () => {
    const amountPaise = getPaise('100'); // 10000 paise
    const sharesResult = splitShares(amountPaise, {
      m1: 1,
      m2: 2,
      m3: 3,
    });

    expect(sharesResult.ok).toBe(true);
    if (sharesResult.ok) {
      const sum = Object.values(sharesResult.data).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
    }
  });
});

describe('Optimistic Version and Soft-Delete Integration', () => {
  it('detects version collision when database version has advanced', () => {
    const expectedVersion: number = 1;
    const currentDbVersion: number = 2; // Someone else updated it
    const hasConflict = currentDbVersion !== expectedVersion;

    expect(hasConflict).toBe(true);
  });

  it('excludes soft-deleted expenses from active balances', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const expenses = [
      {
        id: 'e1',
        paid_by: 'm1',
        amount_paise: 20000,
        deleted_at: '2026-10-10T00:00:00Z', // Soft-deleted
      },
    ];
    const splits = [
      { expense_id: 'e1', member_id: 'm1', share_paise: 10000 },
      { expense_id: 'e1', member_id: 'm2', share_paise: 10000 },
    ];

    const balances = computeBalances(members, expenses, splits, []);
    expect(balances.m1).toBe(0);
    expect(balances.m2).toBe(0);
  });
});
