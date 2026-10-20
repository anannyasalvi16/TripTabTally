import { formatPaise } from './money';

export interface DueReminderMessageOptions {
  debtorName: string;
  creditorName: string;
  amountPaise: number;
  tripName: string;
  upiId?: string | null;
  settleUrl?: string | null;
}

/**
 * Generates a polite, ready-to-send payment reminder text.
 */
export function formatDueReminderMessage(options: DueReminderMessageOptions): string {
  const { debtorName, creditorName, amountPaise, tripName, upiId, settleUrl } = options;
  const formattedAmount = formatPaise(amountPaise);

  let upiPart = '';
  if (upiId && upiId.trim()) {
    upiPart = ` Pay via UPI: ${upiId.trim()}.`;
  }

  let linkPart = '';
  if (settleUrl && settleUrl.trim()) {
    linkPart = ` View ledger: ${settleUrl.trim()}`;
  }

  return `Hi ${debtorName}, you have a pending payment of ${formattedAmount} to ${creditorName} for "${tripName}".${upiPart}${linkPart}`.trim();
}

/**
 * Cleans phone number by removing spaces, brackets, hyphens.
 */
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '');
}

/**
 * Creates a WhatsApp share URL.
 */
export function getWhatsAppShareUrl(message: string, phone?: string | null): string {
  const clean = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  if (clean) {
    // Strip leading '+' for wa.me link
    const waPhone = clean.replace(/^\+/, '');
    return `https://wa.me/${waPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Creates an SMS share URL.
 */
export function getSmsShareUrl(message: string, phone?: string | null): string {
  const clean = cleanPhoneNumber(phone);
  const encodedBody = encodeURIComponent(message);
  if (clean) {
    return `sms:${clean}?body=${encodedBody}`;
  }
  return `sms:?body=${encodedBody}`;
}

/**
 * Checks if a reminder can be sent under the 1-per-day rate limit (24-hour window).
 */
export function canSendReminder(
  lastRemindedAt?: string | null,
  referenceTime = new Date()
): { allowed: boolean; waitHoursRemaining?: number; lastRemindedAtFormatted?: string; reason?: string } {
  if (!lastRemindedAt) {
    return { allowed: true };
  }

  const lastDate = new Date(lastRemindedAt);
  if (isNaN(lastDate.getTime())) {
    return { allowed: true };
  }

  const diffMs = referenceTime.getTime() - lastDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs >= dayMs) {
    return { allowed: true };
  }

  const remainingMs = dayMs - diffMs;
  const waitHoursRemaining = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

  return {
    allowed: false,
    waitHoursRemaining,
    reason: `Reminder already sent recently. You can send at most once every 24 hours (wait ${waitHoursRemaining}h).`,
    lastRemindedAtFormatted: lastDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}
