import { describe, it, expect } from 'vitest';
import {
  formatDueReminderMessage,
  cleanPhoneNumber,
  getWhatsAppShareUrl,
  getSmsShareUrl,
  canSendReminder,
} from '@/lib/reminders';

describe('Payment Due Reminders', () => {
  it('formats reminder message without UPI or link', () => {
    const msg = formatDueReminderMessage({
      debtorName: 'Karan',
      creditorName: 'Rohan',
      amountPaise: 150000,
      tripName: 'Goa 2026',
    });

    expect(msg).toBe('Hi Karan, you have a pending payment of ₹1,500.00 to Rohan for "Goa 2026".');
  });

  it('formats reminder message with UPI ID and settle URL', () => {
    const msg = formatDueReminderMessage({
      debtorName: 'Meera',
      creditorName: 'Rohan',
      amountPaise: 25050,
      tripName: 'Goa 2026',
      upiId: 'rohan@okaxis',
      settleUrl: 'https://tripplanner.app/trips/123/settle',
    });

    expect(msg).toContain('Hi Meera, you have a pending payment of ₹250.50 to Rohan for "Goa 2026".');
    expect(msg).toContain('Pay via UPI: rohan@okaxis.');
    expect(msg).toContain('View ledger: https://tripplanner.app/trips/123/settle');
  });

  it('cleans phone numbers correctly', () => {
    expect(cleanPhoneNumber('+91 98765-43210')).toBe('+919876543210');
    expect(cleanPhoneNumber('(022) 2345 6789')).toBe('02223456789');
    expect(cleanPhoneNumber(null)).toBe('');
  });

  it('generates WhatsApp share URL with and without phone number', () => {
    const urlWithPhone = getWhatsAppShareUrl('Hello Test', '+91 9876543210');
    expect(urlWithPhone).toContain('https://wa.me/919876543210?text=Hello%20Test');

    const urlWithoutPhone = getWhatsAppShareUrl('Hello Test');
    expect(urlWithoutPhone).toContain('https://api.whatsapp.com/send?text=Hello%20Test');
  });

  it('generates SMS share URL with and without phone number', () => {
    const urlWithPhone = getSmsShareUrl('Hello Test', '+91 9876543210');
    expect(urlWithPhone).toBe('sms:+919876543210?body=Hello%20Test');

    const urlWithoutPhone = getSmsShareUrl('Hello Test');
    expect(urlWithoutPhone).toBe('sms:?body=Hello%20Test');
  });

  it('enforces 24-hour rate limit on reminders', () => {
    // No prior reminder -> allowed
    const allowFirst = canSendReminder(null);
    expect(allowFirst.allowed).toBe(true);

    // Prior reminder 2 hours ago -> rejected
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const rejectRecent = canSendReminder(twoHoursAgo);
    expect(rejectRecent.allowed).toBe(false);
    expect(rejectRecent.reason).toContain('once every 24 hours');
    expect(rejectRecent.waitHoursRemaining).toBeGreaterThanOrEqual(21);

    // Prior reminder 25 hours ago -> allowed
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const allowOld = canSendReminder(twentyFiveHoursAgo);
    expect(allowOld.allowed).toBe(true);
  });
});
