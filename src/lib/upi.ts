import type { Paise } from './money/types';

export interface UpiLinkOptions {
  upiId: string;
  receiverName: string;
  amountPaise: Paise;
  tripName: string;
}

/**
 * Builds a UPI deep link according to TRD Section 10:
 * upi://pay?pa={upiId}&pn={receiverName}&am={amount with 2 decimals}&cu=INR&tn={note}
 *
 * The note is `{Trip name} settle up`, trimmed to 50 characters.
 */
export function buildUpiLink(options: UpiLinkOptions): string {
  const { upiId, receiverName, amountPaise, tripName } = options;

  const rawNote = `${tripName} settle up`;
  const note = rawNote.slice(0, 50);

  const amountRupees = (amountPaise / 100).toFixed(2);

  const params = new URLSearchParams({
    pa: upiId,
    pn: receiverName,
    am: amountRupees,
    cu: 'INR',
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}

/**
 * Validates a UPI ID against standard VPA format:
 * ^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$
 */
export function isValidUpiId(upiId: string | null | undefined): boolean {
  if (!upiId) return false;
  const regex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return regex.test(upiId.trim());
}
