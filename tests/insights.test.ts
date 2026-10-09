import { describe, it, expect } from 'vitest';
import { generateInsights, getDaysCount } from '@/lib/insights';

describe('Template Insights Generator', () => {
  it('correctly calculates day differences inclusive', () => {
    expect(getDaysCount('2026-12-10', '2026-12-10')).toBe(1);
    expect(getDaysCount('2026-12-10', '2026-12-12')).toBe(3);
    expect(getDaysCount('2026-12-01', '2026-12-10')).toBe(10);
  });

  it('generates over-limit category sentence with real values', () => {
    const insights = generateInsights({
      categories: [
        { category: 'food', spentPaise: 1120000, limitPaise: 800000 }, // 11,200 vs 8,000 -> 3,200 over
        { category: 'stay', spentPaise: 500000, limitPaise: 600000 },
      ],
      members: [],
    });

    expect(insights).toContain('Food is ₹3,200 over its limit of ₹8,000.');
  });

  it('generates largest category percentage sentence', () => {
    const insights = generateInsights({
      categories: [
        { category: 'food', spentPaise: 400000 }, // 40%
        { category: 'stay', spentPaise: 600000 }, // 60%
      ],
      members: [],
    });

    expect(insights).toContain('Stay is 60% of what you have spent so far.');
  });

  it('generates spending pace sentence based on dates and budget', () => {
    // 5 day trip: 2026-12-01 to 2026-12-05 -> total 5 days
    // budget: 10,000 Rs (1000000 paise) -> planned per day = 2,000 Rs (200000 paise)
    // 2 days elapsed (e.g. today is 2026-12-02), spent 4,700 Rs (470000 paise) -> 2,350 Rs/day
    const insights = generateInsights({
      categories: [{ category: 'food', spentPaise: 470000 }],
      members: [],
      pace: {
        totalSpentPaise: 470000,
        budgetPaise: 1000000,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        currentDate: '2026-12-02',
      },
    });

    expect(insights).toContain('You are spending ₹2,350 a day against ₹2,000 planned.');
  });

  it('generates biggest payer sentence', () => {
    const insights = generateInsights({
      categories: [
        { category: 'food', spentPaise: 1000000 },
      ],
      members: [
        { displayName: 'Rohan', paidPaise: 700000 },
        { displayName: 'Meera', paidPaise: 300000 },
      ],
    });

    expect(insights).toContain('Rohan has paid ₹7,000, which is 70% of all spending.');
  });

  it('limits total output to at most 4 sentences and returns empty when no spending exists', () => {
    const emptyInsights = generateInsights({
      categories: [],
      members: [],
    });
    expect(emptyInsights).toEqual([]);
  });
});
