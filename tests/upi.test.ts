import { describe, it, expect } from 'vitest';
import { buildUpiLink, isValidUpiId } from '@/lib/upi';

describe('UPI Link Builder and Validator', () => {
  it('builds a valid standard UPI deep link', () => {
    const link = buildUpiLink({
      upiId: 'rohan@okhdfcbank',
      receiverName: 'Rohan Sharma',
      amountPaise: 120000, // Rs 1,200.00
      tripName: 'Goa Trip 2026',
    });

    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=rohan%40okhdfcbank');
    expect(link).toContain('pn=Rohan+Sharma');
    expect(link).toContain('am=1200.00');
    expect(link).toContain('cu=INR');
    expect(link).toContain('tn=Goa+Trip+2026+settle+up');
  });

  it('formats amounts with cents/paise accurately', () => {
    const link = buildUpiLink({
      upiId: 'meera@okaxis',
      receiverName: 'Meera',
      amountPaise: 45050, // Rs 450.50
      tripName: 'Manali Trek',
    });

    expect(link).toContain('am=450.50');
  });

  it('trims note to 50 characters maximum', () => {
    const link = buildUpiLink({
      upiId: 'user@bank',
      receiverName: 'User',
      amountPaise: 10000,
      tripName: 'A Very Long Trip Name That Exceeds The Maximum Note Length Allowed',
    });

    const parsed = new URL(link);
    const tn = parsed.searchParams.get('tn');
    expect(tn?.length).toBeLessThanOrEqual(50);
  });

  it('validates UPI ID format strictly', () => {
    expect(isValidUpiId('rohan@okhdfcbank')).toBe(true);
    expect(isValidUpiId('john.doe@icici')).toBe(true);
    expect(isValidUpiId('9876543210@paytm')).toBe(true);

    expect(isValidUpiId('')).toBe(false);
    expect(isValidUpiId(null)).toBe(false);
    expect(isValidUpiId('invalid-without-at')).toBe(false);
    expect(isValidUpiId('a@b')).toBe(false); // too short
  });
});
