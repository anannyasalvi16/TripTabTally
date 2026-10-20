import {
  parseAndValidateDate,
  validateExpenseDate,
  formatIsoToDisplay,
} from './schemas/date-utils';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'custom';

export interface RecurrenceOptions {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  frequency: RecurrenceFrequency;
  intervalDays?: number;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}

export interface RecurrenceResult {
  ok: boolean;
  error?: string;
  dates: string[];
}

/**
 * Generates an array of occurrence dates (YYYY-MM-DD) for a recurring expense.
 * Respects trip boundaries, sane date limits, calendar validity, and max count bounds.
 */
export function generateRecurringDates(options: RecurrenceOptions): RecurrenceResult {
  const {
    startDate,
    endDate,
    frequency,
    intervalDays: rawInterval = 1,
    tripStartDate,
    tripEndDate,
  } = options;

  // 1. Validate start and end dates
  const parsedStart = parseAndValidateDate(startDate);
  if (!parsedStart.valid || !parsedStart.isoDate) {
    return { ok: false, error: parsedStart.error || 'Invalid start date.', dates: [] };
  }

  const parsedEnd = parseAndValidateDate(endDate);
  if (!parsedEnd.valid || !parsedEnd.isoDate) {
    return { ok: false, error: parsedEnd.error || 'Invalid end date.', dates: [] };
  }

  const startIso = parsedStart.isoDate;
  const endIso = parsedEnd.isoDate;

  if (endIso < startIso) {
    return {
      ok: false,
      error: 'Recurring end date cannot be earlier than expense start date.',
      dates: [],
    };
  }

  // 2. Validate trip boundaries
  const startValidation = validateExpenseDate(startIso, tripStartDate, tripEndDate);
  if (!startValidation.valid) {
    return { ok: false, error: startValidation.error || 'Start date is outside trip dates.', dates: [] };
  }

  let effectiveEndIso = endIso;
  if (tripEndDate && tripEndDate < effectiveEndIso) {
    effectiveEndIso = tripEndDate;
  }

  // 3. Determine step interval in days
  let step = 1;
  if (frequency === 'daily') {
    step = 1;
  } else if (frequency === 'weekly') {
    step = 7;
  } else if (frequency === 'custom') {
    step = Math.floor(rawInterval);
    if (isNaN(step) || step < 1 || step > 365) {
      return { ok: false, error: 'Repeat interval must be between 1 and 365 days.', dates: [] };
    }
  }

  // 4. Generate dates step-by-step using UTC calendar math to avoid timezone shifts
  const [startY, startM, startD] = startIso.split('-').map(Number);
  const [endY, endM, endD] = effectiveEndIso.split('-').map(Number);

  if (!startY || !startM || !startD || !endY || !endM || !endD) {
    return { ok: false, error: 'Invalid date structure.', dates: [] };
  }

  const startUtc = Date.UTC(startY, startM - 1, startD);
  const endUtc = Date.UTC(endY, endM - 1, endD);

  const dates: string[] = [];
  let currentUtc = startUtc;
  const dayMs = 86400000;

  while (currentUtc <= endUtc) {
    const d = new Date(currentUtc);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    // Verify each generated date
    const check = validateExpenseDate(dateStr, tripStartDate, tripEndDate);
    if (!check.valid) {
      break;
    }

    dates.push(dateStr);

    if (dates.length >= 365) {
      break;
    }

    currentUtc += step * dayMs;
  }

  if (dates.length === 0) {
    return { ok: false, error: 'No valid dates generated within trip bounds.', dates: [] };
  }

  return { ok: true, dates };
}

export interface RecurrenceSummaryOptions {
  count?: number;
  frequency: RecurrenceFrequency;
  intervalDays?: number;
  startDate: string;
  endDate: string;
}

/**
 * Returns a human-friendly summary of the recurring rule.
 */
export function formatRecurrenceSummary(options: RecurrenceSummaryOptions): string {
  const { frequency, intervalDays = 1, startDate, endDate } = options;
  let count = options.count;
  if (count === undefined) {
    const res = generateRecurringDates({
      startDate,
      endDate,
      frequency,
      intervalDays,
    });
    count = res.dates.length;
  }

  const startDisplay = formatIsoToDisplay(startDate);
  const endDisplay = formatIsoToDisplay(endDate);

  let freqText = 'daily';
  if (frequency === 'weekly') freqText = 'weekly';
  else if (frequency === 'custom') freqText = `every ${intervalDays} days`;

  const plural = count === 1 ? 'occurrence' : 'occurrences';
  return `Repeats ${freqText}: ${count} ${plural} (from ${startDisplay} to ${endDisplay})`;
}
