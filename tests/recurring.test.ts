import { describe, it, expect } from 'vitest';
import { generateRecurringDates, formatRecurrenceSummary } from '@/lib/recurring';

describe('Recurring Expenses Generation', () => {
  it('generates daily occurrences within trip bounds', () => {
    const result = generateRecurringDates({
      startDate: '2026-12-10',
      endDate: '2026-12-14',
      tripStartDate: '2026-12-01',
      tripEndDate: '2026-12-20',
      frequency: 'daily',
      intervalDays: 1,
    });

    expect(result.error).toBeUndefined();
    expect(result.dates).toEqual([
      '2026-12-10',
      '2026-12-11',
      '2026-12-12',
      '2026-12-13',
      '2026-12-14',
    ]);
  });

  it('caps occurrences at tripEndDate when repeat endDate exceeds it', () => {
    const result = generateRecurringDates({
      startDate: '2026-12-10',
      endDate: '2026-12-25',
      tripStartDate: '2026-12-01',
      tripEndDate: '2026-12-13',
      frequency: 'daily',
      intervalDays: 1,
    });

    expect(result.error).toBeUndefined();
    expect(result.dates).toEqual([
      '2026-12-10',
      '2026-12-11',
      '2026-12-12',
      '2026-12-13',
    ]);
  });

  it('generates weekly occurrences correctly', () => {
    const result = generateRecurringDates({
      startDate: '2026-05-01',
      endDate: '2026-05-25',
      tripStartDate: '2026-05-01',
      tripEndDate: '2026-05-31',
      frequency: 'weekly',
      intervalDays: 7,
    });

    expect(result.error).toBeUndefined();
    expect(result.dates).toEqual([
      '2026-05-01',
      '2026-05-08',
      '2026-05-15',
      '2026-05-22',
    ]);
  });

  it('generates custom N-day intervals correctly', () => {
    const result = generateRecurringDates({
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      frequency: 'custom',
      intervalDays: 3,
    });

    expect(result.error).toBeUndefined();
    expect(result.dates).toEqual([
      '2026-06-01',
      '2026-06-04',
      '2026-06-07',
      '2026-06-10',
    ]);
  });

  it('handles month rollovers and leap year correctly', () => {
    // 2028 is a leap year; Feb has 29 days
    const result = generateRecurringDates({
      startDate: '2028-02-27',
      endDate: '2028-03-02',
      frequency: 'daily',
      intervalDays: 1,
    });

    expect(result.error).toBeUndefined();
    expect(result.dates).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
      '2028-03-02',
    ]);
  });

  it('rejects impossible dates in input', () => {
    const result = generateRecurringDates({
      startDate: '2026-02-31',
      endDate: '2026-03-05',
      frequency: 'daily',
    });

    expect(result.error).toBe("Invalid date: this day doesn't exist in the selected month.");
    expect(result.dates).toEqual([]);
  });

  it('rejects start date after end date', () => {
    const result = generateRecurringDates({
      startDate: '2026-07-15',
      endDate: '2026-07-10',
      frequency: 'daily',
    });

    expect(result.error).toContain('cannot be earlier than');
    expect(result.dates).toEqual([]);
  });

  it('rejects start date outside trip boundaries', () => {
    const result = generateRecurringDates({
      startDate: '2026-04-10',
      endDate: '2026-04-20',
      tripStartDate: '2026-04-12',
      tripEndDate: '2026-04-30',
      frequency: 'daily',
    });

    expect(result.error).toContain('Expense date must be between');
  });

  it('enforces safety cap of 365 occurrences', () => {
    const result = generateRecurringDates({
      startDate: '2026-01-01',
      endDate: '2028-01-01',
      frequency: 'daily',
      intervalDays: 1,
    });

    expect(result.dates.length).toBe(365);
  });
});

describe('Recurrence Summary Formatter', () => {
  it('formats daily recurrence summary', () => {
    const text = formatRecurrenceSummary({
      frequency: 'daily',
      startDate: '2026-12-10',
      endDate: '2026-12-15',
    });
    expect(text).toContain('Repeats daily');
    expect(text).toContain('6 occurrences');
  });

  it('formats weekly recurrence summary', () => {
    const text = formatRecurrenceSummary({
      frequency: 'weekly',
      startDate: '2026-05-01',
      endDate: '2026-05-25',
    });
    expect(text).toContain('Repeats weekly');
    expect(text).toContain('4 occurrences');
  });

  it('formats custom interval recurrence summary', () => {
    const text = formatRecurrenceSummary({
      frequency: 'custom',
      intervalDays: 3,
      startDate: '2026-06-01',
      endDate: '2026-06-10',
    });
    expect(text).toContain('Repeats every 3 days');
    expect(text).toContain('4 occurrences');
  });
});
