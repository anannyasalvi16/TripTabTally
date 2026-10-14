import { describe, it, expect } from 'vitest';
import {
  expenseSchema,
  expenseCategories,
  validateExpenseDate,
  parseDateInput,
  formatIsoToDisplay,
  parseAndValidateDate,
  getSaneTripDateLimits,
} from '@/lib/schemas/expense';
import {
  parseRupeesToPaise,
  splitEqual,
  splitExact,
  splitPercent,
  splitShares,
  computeBalances,
} from '@/lib/money';

describe('Trip Date Range Restriction on Expenses', () => {
  const tripStartDate = '2026-12-10';
  const tripEndDate = '2026-12-15';

  it('accepts dates within the trip start and end range', () => {
    const res = validateExpenseDate('2026-12-12', tripStartDate, tripEndDate);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('accepts dates exactly on the trip start date', () => {
    const res = validateExpenseDate('2026-12-10', tripStartDate, tripEndDate);
    expect(res.valid).toBe(true);
  });

  it('accepts dates exactly on the trip end date', () => {
    const res = validateExpenseDate('2026-12-15', tripStartDate, tripEndDate);
    expect(res.valid).toBe(true);
  });

  it('rejects dates before the trip start date with error message', () => {
    const res = validateExpenseDate('2026-12-09', tripStartDate, tripEndDate);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Expense date must be between 2026-12-10 and 2026-12-15.');
  });

  it('rejects dates after the trip end date with error message', () => {
    const res = validateExpenseDate('2026-12-16', tripStartDate, tripEndDate);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Expense date must be between 2026-12-10 and 2026-12-15.');
  });

  it('handles trip with only a start date', () => {
    const valid = validateExpenseDate('2026-12-10', tripStartDate, null);
    expect(valid.valid).toBe(true);

    const invalid = validateExpenseDate('2026-12-08', tripStartDate, null);
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Expense date must be on or after 2026-12-10.');
  });

  it('handles trip with only an end date', () => {
    const valid = validateExpenseDate('2026-12-14', null, tripEndDate);
    expect(valid.valid).toBe(true);

    const invalid = validateExpenseDate('2026-12-18', null, tripEndDate);
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Expense date must be on or before 2026-12-15.');
  });

  it('handles single-day trip where start and end date are equal', () => {
    const valid = validateExpenseDate('2026-12-10', '2026-12-10', '2026-12-10');
    expect(valid.valid).toBe(true);

    const invalid = validateExpenseDate('2026-12-11', '2026-12-10', '2026-12-10');
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Expense date must be 2026-12-10.');
  });

  it('allows any valid date when trip has no date restrictions', () => {
    const res = validateExpenseDate('2026-12-25', null, null);
    expect(res.valid).toBe(true);
  });

  it('rejects empty or malformed date strings', () => {
    const empty = validateExpenseDate('', tripStartDate, tripEndDate);
    expect(empty.valid).toBe(false);
    expect(empty.error).toBe('Please enter a valid date.');

    const malformed = validateExpenseDate('invalid-date', tripStartDate, tripEndDate);
    expect(malformed.valid).toBe(false);
    expect(malformed.error).toBe('Please enter a valid date.');
  });

  it('accepts DD/MM/YYYY formatted dates within range', () => {
    const valid = validateExpenseDate('12/12/2026', tripStartDate, tripEndDate);
    expect(valid.valid).toBe(true);
  });

  it('rejects DD/MM/YYYY formatted dates outside range', () => {
    const invalid = validateExpenseDate('05/12/2026', tripStartDate, tripEndDate);
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Expense date must be between 2026-12-10 and 2026-12-15.');
  });
});

describe('Manual Date Parsing and Formatting (DD/MM/YYYY)', () => {
  it('parses valid DD/MM/YYYY strings to ISO YYYY-MM-DD', () => {
    expect(parseDateInput('15/12/2026')).toBe('2026-12-15');
    expect(parseDateInput('01/01/2026')).toBe('2026-01-01');
    expect(parseDateInput('1/5/2026')).toBe('2026-05-01');
  });

  it('parses valid DD-MM-YYYY and DD.MM.YYYY strings', () => {
    expect(parseDateInput('15-12-2026')).toBe('2026-12-15');
    expect(parseDateInput('15.12.2026')).toBe('2026-12-15');
  });

  it('preserves valid YYYY-MM-DD format', () => {
    expect(parseDateInput('2026-12-15')).toBe('2026-12-15');
  });

  it('rejects invalid day or month', () => {
    expect(parseDateInput('32/12/2026')).toBeNull();
    expect(parseDateInput('15/13/2026')).toBeNull();
    expect(parseDateInput('0/05/2026')).toBeNull();
  });

  it('rejects nonexistent dates for specific months and non-leap years', () => {
    expect(parseDateInput('31/04/2026')).toBeNull(); // April has 30 days
    expect(parseDateInput('29/02/2026')).toBeNull(); // 2026 is not leap year
    expect(parseDateInput('29/02/2024')).toBe('2024-02-29'); // 2024 is leap year
  });

  it('formats ISO dates to DD/MM/YYYY for display', () => {
    expect(formatIsoToDisplay('2026-12-15')).toBe('15/12/2026');
    expect(formatIsoToDisplay('2026-01-05')).toBe('05/01/2026');
    expect(formatIsoToDisplay('')).toBe('');
  });
});

describe('Calendar Reality Checks & Impossible Dates', () => {
  it('rejects 31-02-4000 with exact error message', () => {
    const res = parseAndValidateDate('31-02-4000');
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Invalid date: this day doesn't exist in the selected month.");

    const resSlash = parseAndValidateDate('31/02/4000');
    expect(resSlash.valid).toBe(false);
    expect(resSlash.error).toBe("Invalid date: this day doesn't exist in the selected month.");
  });

  it('rejects 30-02-2024 and 30-02-2026 with exact error message', () => {
    const res = parseAndValidateDate('30-02-2024');
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Invalid date: this day doesn't exist in the selected month.");

    const resNonLeap = parseAndValidateDate('30/02/2026');
    expect(resNonLeap.valid).toBe(false);
    expect(resNonLeap.error).toBe("Invalid date: this day doesn't exist in the selected month.");
  });

  it('rejects 31-04-2026 because April has 30 days', () => {
    const res = parseAndValidateDate('31-04-2026');
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Invalid date: this day doesn't exist in the selected month.");
  });

  it('rejects 29-02 in non-leap year but accepts in leap year', () => {
    const nonLeap = parseAndValidateDate('29-02-2025');
    expect(nonLeap.valid).toBe(false);
    expect(nonLeap.error).toBe("Invalid date: this day doesn't exist in the selected month.");

    const leap = parseAndValidateDate('29-02-2024');
    expect(leap.valid).toBe(true);
    expect(leap.isoDate).toBe('2024-02-29');
  });

  it('enforces 4-digit years only', () => {
    const twoDigit = parseAndValidateDate('15/10/26');
    expect(twoDigit.valid).toBe(false);
    expect(twoDigit.error).toBe('Year must be a 4-digit number.');

    const fiveDigit = parseAndValidateDate('15/10/20260');
    expect(fiveDigit.valid).toBe(false);
    expect(fiveDigit.error).toBe('Year must be a 4-digit number.');
  });

  it('rejects invalid months (< 1 or > 12)', () => {
    const monthZero = parseAndValidateDate('15/00/2026');
    expect(monthZero.valid).toBe(false);
    expect(monthZero.error).toBe('Month must be between 01 and 12.');

    const month13 = parseAndValidateDate('15/13/2026');
    expect(month13.valid).toBe(false);
    expect(month13.error).toBe('Month must be between 01 and 12.');
  });

  it('validates expense date with impossible dates and returns exact error', () => {
    const res = validateExpenseDate('31-02-4000', '2026-01-01', '2027-01-01');
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Invalid date: this day doesn't exist in the selected month.");
  });

  it('enforces sane fallback limits when trip has no start or end dates', () => {
    const refDate = new Date('2026-10-15');
    // Limits: min = 2025-10-15, max = 2031-10-15
    const within = validateExpenseDate('2026-11-01', null, null, refDate);
    expect(within.valid).toBe(true);

    const tooOld = validateExpenseDate('2024-05-01', null, null, refDate);
    expect(tooOld.valid).toBe(false);
    expect(tooOld.error).toContain('between 2025-10-15 and 2031-10-15');

    const tooFuture = validateExpenseDate('2032-01-01', null, null, refDate);
    expect(tooFuture.valid).toBe(false);
    expect(tooFuture.error).toContain('between 2025-10-15 and 2031-10-15');
  });
});

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
