import { describe, it, expect } from 'vitest';

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

describe('CSV Export Formatting and Escaping', () => {
  it('escapes text with commas correctly', () => {
    expect(escapeCsv('Cab to Candolim, North Goa')).toBe('"Cab to Candolim, North Goa"');
  });

  it('escapes text with double quotes correctly', () => {
    expect(escapeCsv('The "Best" Cafe')).toBe('"The ""Best"" Cafe"');
  });

  it('leaves clean text unquoted', () => {
    expect(escapeCsv('Dinner')).toBe('Dinner');
  });

  it('handles null and undefined gracefully', () => {
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(undefined)).toBe('');
  });

  it('formats two-decimal rupee strings accurately', () => {
    const amountPaise = 125050; // Rs 1250.50
    const rupees = (amountPaise / 100).toFixed(2);
    expect(rupees).toBe('1250.50');
  });
});
