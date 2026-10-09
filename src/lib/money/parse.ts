import type { Paise, Result } from './types';

export const MAX_PAISE = 1000000000; // Rs 1,00,00,000 = 1,000,000,000 paise

/**
 * Parses a rupee string into integer paise using exact string manipulation.
 * Avoids floating-point multiplication (no parseFloat * 100).
 */
export function parseRupeesToPaise(input: string): Result<Paise> {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Input must be a string.' };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Amount cannot be empty.' };
  }

  // Strip currency symbol if present
  let sanitized = trimmed;
  if (sanitized.startsWith('₹')) {
    sanitized = sanitized.slice(1).trim();
  } else if (sanitized.startsWith('Rs.') || sanitized.startsWith('Rs')) {
    sanitized = sanitized.replace(/^Rs\.?\s*/i, '').trim();
  }

  if (sanitized.length === 0) {
    return { ok: false, error: 'Amount cannot be empty.' };
  }

  if (sanitized.startsWith('-')) {
    return { ok: false, error: 'Amount cannot be negative.' };
  }

  // Remove commas
  const withoutCommas = sanitized.replace(/,/g, '');

  // Reject any invalid characters (only digits and at most one decimal point allowed)
  if (!/^\d+(\.\d+)?$/.test(withoutCommas)) {
    return { ok: false, error: 'Amount must contain only digits and an optional decimal point.' };
  }

  const parts = withoutCommas.split('.');
  const wholePart = parts[0] || '0';
  const decimalPart = parts[1] || '';

  if (decimalPart.length > 2) {
    return { ok: false, error: 'Amount cannot have more than 2 decimal places.' };
  }

  // Pad decimal part to exactly 2 digits: "5" -> "50", "" -> "00", "50" -> "50"
  const paddedDecimals = decimalPart.padEnd(2, '0');

  // Strip leading zeroes from rupees unless it is zero
  const cleanWhole = wholePart.replace(/^0+(?=\d)/, '');

  const totalPaiseStr = cleanWhole + paddedDecimals;
  const paise = Number(totalPaiseStr);

  if (!Number.isSafeInteger(paise) || paise < 0) {
    return { ok: false, error: 'Invalid money amount.' };
  }

  if (paise > MAX_PAISE) {
    return { ok: false, error: 'Amount exceeds the maximum limit of ₹1,00,00,000.' };
  }

  return { ok: true, data: paise };
}
