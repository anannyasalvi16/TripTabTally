import { describe, it, expect } from 'vitest';
import {
  parseRupeesToPaise,
  formatPaise,
  splitEqual,
  splitExact,
  splitPercent,
  splitShares,
  splitFamily,
  computeBalances,
  computeFamilyBalances,
  planSettlement,
  applySettlementPlan,
  verifyZeroSum,
} from '@/lib/money';

describe('Rupee Parser (parseRupeesToPaise)', () => {
  it('parses whole rupee amounts', () => {
    expect(parseRupeesToPaise('1200')).toEqual({ ok: true, data: 120000 });
    expect(parseRupeesToPaise('0')).toEqual({ ok: true, data: 0 });
    expect(parseRupeesToPaise('1')).toEqual({ ok: true, data: 100 });
  });

  it('parses comma-separated strings', () => {
    expect(parseRupeesToPaise('1,200')).toEqual({ ok: true, data: 120000 });
    expect(parseRupeesToPaise('1,23,456.78')).toEqual({ ok: true, data: 12345678 });
  });

  it('parses single and double decimal amounts correctly without float errors', () => {
    expect(parseRupeesToPaise('1200.5')).toEqual({ ok: true, data: 120050 });
    expect(parseRupeesToPaise('1200.50')).toEqual({ ok: true, data: 120050 });
    expect(parseRupeesToPaise('0.05')).toEqual({ ok: true, data: 5 });
    expect(parseRupeesToPaise('0.99')).toEqual({ ok: true, data: 99 });
  });

  it('parses strings with rupee symbol or prefix', () => {
    expect(parseRupeesToPaise('₹1,200.50')).toEqual({ ok: true, data: 120050 });
    expect(parseRupeesToPaise('Rs. 500')).toEqual({ ok: true, data: 50000 });
  });

  it('rejects more than 2 decimal places', () => {
    const res = parseRupeesToPaise('12.345');
    expect(res.ok).toBe(false);
  });

  it('rejects negative amounts', () => {
    const res = parseRupeesToPaise('-500');
    expect(res.ok).toBe(false);
  });

  it('rejects empty input or letters', () => {
    expect(parseRupeesToPaise('').ok).toBe(false);
    expect(parseRupeesToPaise('   ').ok).toBe(false);
    expect(parseRupeesToPaise('abc').ok).toBe(false);
    expect(parseRupeesToPaise('12a').ok).toBe(false);
  });

  it('rejects amounts above the max limit of 1 crore rupees', () => {
    expect(parseRupeesToPaise('10000001').ok).toBe(false);
  });
});

describe('Indian Currency Formatter (formatPaise)', () => {
  it('formats with exact Indian numbering grouping', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
    expect(formatPaise(100000)).toBe('₹1,000.00');
    expect(formatPaise(10000000)).toBe('₹1,00,000.00');
    expect(formatPaise(1000000000)).toBe('₹1,00,00,000.00');
  });

  it('handles small amounts and zero', () => {
    expect(formatPaise(0)).toBe('₹0.00');
    expect(formatPaise(50)).toBe('₹0.50');
    expect(formatPaise(5)).toBe('₹0.05');
  });

  it('respects showZeroDecimals: false for whole numbers', () => {
    expect(formatPaise(10000, { showZeroDecimals: false })).toBe('₹100');
    expect(formatPaise(123450, { showZeroDecimals: false })).toBe('₹1,234.50');
  });

  it('supports omitting currency symbol', () => {
    expect(formatPaise(12345678, { includeSymbol: false })).toBe('1,23,456.78');
  });
});

describe('Equal Split (splitEqual)', () => {
  it('splits ₹100 among 3 people to sum to exactly 10000 paise', () => {
    const members = ['m1', 'm2', 'm3'];
    const split1 = splitEqual(10000, members, 'expense-seed-1');
    const sum1 = Object.values(split1).reduce((a, b) => a + b, 0);

    expect(sum1).toBe(10000);
    expect(Object.values(split1).sort()).toEqual([3333, 3333, 3334]);
  });

  it('rotates the extra paisa across different seeds so the same person does not always pay it', () => {
    const members = ['m1', 'm2', 'm3'];
    const recipientsWithExtra = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const split = splitEqual(10000, members, `seed-${i}`);
      const extraPerson = Object.entries(split).find(([, val]) => val === 3334)?.[0];
      if (extraPerson) {
        recipientsWithExtra.add(extraPerson);
      }
    }

    // Must have rotated across more than one recipient
    expect(recipientsWithExtra.size).toBeGreaterThan(1);
  });

  it('handles total < n (e.g. 2 paise among 5 people)', () => {
    const members = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const split = splitEqual(2, members, 'small-seed');
    const sum = Object.values(split).reduce((a, b) => a + b, 0);

    expect(sum).toBe(2);
    const ones = Object.values(split).filter((v) => v === 1).length;
    const zeros = Object.values(split).filter((v) => v === 0).length;
    expect(ones).toBe(2);
    expect(zeros).toBe(3);
  });
});

describe('Exact Split (splitExact)', () => {
  it('accepts exact matching sum', () => {
    const res = splitExact(10000, {
      m1: 4000,
      m2: 3500,
      m3: 2500,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ m1: 4000, m2: 3500, m3: 2500 });
    }
  });

  it('returns error with difference when sum is less than total', () => {
    const res = splitExact(10000, {
      m1: 3000,
      m2: 3000, // 4000 missing
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.differencePaise).toBe(4000);
      expect(res.error).toContain('is not assigned to anyone yet');
    }
  });

  it('returns error when sum exceeds total', () => {
    const res = splitExact(10000, {
      m1: 6000,
      m2: 5000, // 1000 over
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('exceed total by');
    }
  });
});

describe('Percentage Split (splitPercent)', () => {
  it('splits with decimals 33.33, 33.33, 33.34 summing to total', () => {
    const res = splitPercent(10000, {
      m1: 33.33,
      m2: 33.33,
      m3: 33.34,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const sum = Object.values(res.data).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
    }
  });

  it('rejects percentages not summing to 100', () => {
    const res = splitPercent(10000, {
      m1: 50,
      m2: 40,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('They need to add up to 100');
    }
  });
});

describe('Shares Split (splitShares)', () => {
  it('splits weights 1, 2, 3 on amount that does not divide evenly', () => {
    const totalPaise = 10000; // 10000 / 6 = 1666.666...
    const res = splitShares(totalPaise, {
      m1: 1,
      m2: 2,
      m3: 3,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const sum = Object.values(res.data).reduce((a, b) => a + b, 0);
      expect(sum).toBe(totalPaise);
    }
  });

  it('supports decimal weights (e.g. adult = 1, kid = 0.5)', () => {
    const totalPaise = 15000; // 15000 across 1 + 0.5 = 1.5 => adult gets 10000, kid gets 5000
    const res = splitShares(totalPaise, {
      adult: 1,
      kid: 0.5,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.adult).toBe(10000);
      expect(res.data.kid).toBe(5000);
      expect(res.data.adult + res.data.kid).toBe(totalPaise);
    }
  });

  it('handles awkward decimal weights and uneven division summing exactly to total paise', () => {
    const totalPaise = 10001; // odd amount
    const res = splitShares(totalPaise, {
      adult1: 1,
      adult2: 1,
      kid1: 0.5,
      kid2: 0.5,
    }); // total weight = 3
    expect(res.ok).toBe(true);
    if (res.ok) {
      const sum = Object.values(res.data).reduce((a, b) => a + b, 0);
      expect(sum).toBe(totalPaise);
    }
  });

  it('rejects zero or negative share counts', () => {
    const res = splitShares(10000, { m1: 0, m2: 2 });
    expect(res.ok).toBe(false);

    const negative = splitShares(10000, { m1: -1, m2: 2 });
    expect(negative.ok).toBe(false);
  });
});

describe('Family Split (splitFamily)', () => {
  const members = [
    { id: 'sharma_dad', familyId: 'fam_sharma', displayName: 'Anil' },
    { id: 'sharma_mom', familyId: 'fam_sharma', displayName: 'Pooja' },
    { id: 'gupta_dad', familyId: 'fam_gupta', displayName: 'Ramesh' },
    { id: 'gupta_son', familyId: 'fam_gupta', displayName: 'Aarav' },
    { id: 'solo_charlie', familyId: null, displayName: 'Charlie' },
  ];

  it('splits equally among 2 families and 1 solo member (3 equal shares)', () => {
    const totalPaise = 30000; // ₹300 => 3 units get ₹100 each (10000 paise)
    const participating = ['sharma_dad', 'sharma_mom', 'gupta_dad', 'gupta_son', 'solo_charlie'];
    const res = splitFamily(totalPaise, members, participating, 'seed-family-1');

    expect(res.ok).toBe(true);
    if (res.ok) {
      // 1. Total sum must equal exactly 30000 paise
      const totalSum = Object.values(res.data.memberShares).reduce((a, b) => a + b, 0);
      expect(totalSum).toBe(30000);

      // 2. Solo Charlie gets full 1 unit (10000)
      expect(res.data.memberShares.solo_charlie).toBe(10000);

      // 3. Sharma family gets 10000 split across 2 members (5000 each)
      expect(res.data.memberShares.sharma_dad).toBe(5000);
      expect(res.data.memberShares.sharma_mom).toBe(5000);

      // 4. Gupta family gets 10000 split across 2 members (5000 each)
      expect(res.data.memberShares.gupta_dad).toBe(5000);
      expect(res.data.memberShares.gupta_son).toBe(5000);

      // 5. Family summaries
      expect(res.data.familyShares['fam_sharma']).toBe(10000);
      expect(res.data.familyShares['fam_gupta']).toBe(10000);
      expect(res.data.familyShares['solo:solo_charlie']).toBe(10000);
    }
  });

  it('guarantees exact sum even with indivisible amounts (Largest Remainder Method)', () => {
    const totalPaise = 10001; // ₹100.01 among 3 units
    const participating = ['sharma_dad', 'sharma_mom', 'gupta_dad', 'solo_charlie'];
    const res = splitFamily(totalPaise, members, participating, 'seed-family-2');

    expect(res.ok).toBe(true);
    if (res.ok) {
      const totalSum = Object.values(res.data.memberShares).reduce((a, b) => a + b, 0);
      expect(totalSum).toBe(totalPaise);
    }
  });

  it('handles expense when only 1 member of a family participates', () => {
    const totalPaise = 12000;
    // Only sharma_dad from Sharma family, and solo_charlie
    const participating = ['sharma_dad', 'solo_charlie'];
    const res = splitFamily(totalPaise, members, participating, 'seed-family-3');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.memberShares.sharma_dad).toBe(6000);
      expect(res.data.memberShares.solo_charlie).toBe(6000);
      expect(res.data.memberShares.sharma_mom ?? 0).toBe(0);
      expect(res.data.memberShares.gupta_dad ?? 0).toBe(0);
    }
  });

  it('rejects split when no members participate', () => {
    const res = splitFamily(10000, members, [], 'seed-empty');
    expect(res.ok).toBe(false);
  });
});

describe('Family Balances and Settlement (computeFamilyBalances)', () => {
  const members = [
    { id: 'm1', familyId: 'f1', displayName: 'Alice' },
    { id: 'm2', familyId: 'f1', displayName: 'Bob' },
    { id: 'm3', familyId: 'f2', displayName: 'Charlie' },
    { id: 'm4', familyId: null, displayName: 'Dave (Solo)' },
  ];

  const families = [
    { id: 'f1', name: 'Sharma family' },
    { id: 'f2', name: 'Gupta family' },
  ];

  it('aggregates individual member balances into family and solo balances', () => {
    const individualBalances = {
      m1: 3000,  // Alice (+30)
      m2: -1000, // Bob (-10) => Sharma family net = +20 (2000)
      m3: -1500, // Charlie (-15) => Gupta family net = -15 (-1500)
      m4: -500,  // Dave (-5) => Dave net = -5 (-500)
    };

    const familyBalances = computeFamilyBalances(individualBalances, members, families);

    const sharma = familyBalances.find((f) => f.id === 'f1');
    const gupta = familyBalances.find((f) => f.id === 'f2');
    const dave = familyBalances.find((f) => f.id === 'm4');

    expect(sharma?.balancePaise).toBe(2000);
    expect(gupta?.balancePaise).toBe(-1500);
    expect(dave?.balancePaise).toBe(-500);

    // Sum of family balances must equal 0
    const totalFamilyBalance = familyBalances.reduce((acc, f) => acc + f.balancePaise, 0);
    expect(totalFamilyBalance).toBe(0);
  });

  it('allows planSettlement on family balances to simplify debts between family units', () => {
    const individualBalances = {
      m1: 3000,
      m2: -1000, // f1 net = +2000
      m3: -1500, // f2 net = -1500
      m4: -500,  // m4 net = -500
    };

    const familyBalances = computeFamilyBalances(individualBalances, members, families);
    const balanceMap: Record<string, number> = {};
    for (const fb of familyBalances) {
      balanceMap[fb.id] = fb.balancePaise;
    }

    const plan = planSettlement(balanceMap);
    // f2 owes 1500 to f1, m4 owes 500 to f1 (total 2 transfers)
    expect(plan.length).toBe(2);

    const after = applySettlementPlan(balanceMap, plan);
    for (const val of Object.values(after)) {
      expect(val).toBe(0);
    }
  });
});

describe('Settlement Planning (planSettlement)', () => {
  it('simplifies three-person circular debts', () => {
    const balances = {
      m1: 5000, // creditor +50
      m2: -2000, // debtor -20
      m3: -3000, // debtor -30
    };

    const plan = planSettlement(balances);
    expect(plan.length).toBeLessThanOrEqual(2);

    const after = applySettlementPlan(balances, plan);
    for (const val of Object.values(after)) {
      expect(val).toBe(0);
    }
  });

  it('throws error if balances do not sum to zero', () => {
    expect(() =>
      planSettlement({
        m1: 1000,
        m2: -500,
      })
    ).toThrow('Balances do not sum to zero');
  });
});

describe('Property Tests: 1,000 Random Trips Invariant', () => {
  // Deterministic pseudo-random number generator (LCG)
  function makePrng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it('proves zero-sum invariant and max (n - 1) transfers for 1,000 random trips', () => {
    const rand = makePrng(42);

    for (let trip = 0; trip < 1000; trip++) {
      const memberCount = 3 + Math.floor(rand() * 10); // 3 to 12 members
      const members = Array.from({ length: memberCount }, (_, i) => ({
        id: `user_${i}`,
      }));

      const expenseCount = 1 + Math.floor(rand() * 15);
      const expenses = [];
      const splits = [];

      for (let e = 0; e < expenseCount; e++) {
        const expenseId = `exp_${trip}_${e}`;
        const payerIndex = Math.floor(rand() * memberCount);
        const payerId = members[payerIndex]!.id;
        const amountPaise = 100 + Math.floor(rand() * 500000); // Rs 1 to Rs 5000

        // Random split among a subset of members
        const subsetSize = 1 + Math.floor(rand() * memberCount);
        const subsetIds = members
          .slice()
          .sort(() => rand() - 0.5)
          .slice(0, subsetSize)
          .map((m) => m.id);

        const splitResult = splitEqual(amountPaise, subsetIds, `seed_${e}`);

        expenses.push({
          id: expenseId,
          paid_by: payerId,
          amount_paise: amountPaise,
          deleted_at: null,
        });

        for (const [mid, share] of Object.entries(splitResult)) {
          splits.push({
            expense_id: expenseId,
            member_id: mid,
            share_paise: share,
          });
        }
      }

      // Add a couple of random settlements
      const settlements = [];
      const settlementCount = Math.floor(rand() * 3);
      for (let s = 0; s < settlementCount; s++) {
        const fromIdx = Math.floor(rand() * memberCount);
        let toIdx = Math.floor(rand() * memberCount);
        if (fromIdx === toIdx) toIdx = (toIdx + 1) % memberCount;

        settlements.push({
          id: `st_${trip}_${s}`,
          from_member: members[fromIdx]!.id,
          to_member: members[toIdx]!.id,
          amount_paise: 50 + Math.floor(rand() * 5000),
          voided_at: null,
        });
      }

      // 1. Invariant: balances sum to zero
      const balances = computeBalances(members, expenses, splits, settlements);
      expect(verifyZeroSum(balances)).toBe(true);

      // 2. Settlement planning
      const nonZeroCount = Object.values(balances).filter((b) => b !== 0).length;
      const plan = planSettlement(balances);

      // Plan length is at most (non-zero members - 1)
      if (nonZeroCount > 0) {
        expect(plan.length).toBeLessThanOrEqual(nonZeroCount - 1);
      } else {
        expect(plan.length).toBe(0);
      }

      // 3. Applying settlement plan brings every member balance to zero
      const after = applySettlementPlan(balances, plan);
      for (const bal of Object.values(after)) {
        expect(bal).toBe(0);
      }
    }
  });
});
