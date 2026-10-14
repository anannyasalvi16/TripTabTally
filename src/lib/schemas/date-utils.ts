/**
 * Shared date validation and parsing utilities.
 * Handles calendar reality checks (leap years, days in month),
 * 4-digit year constraints, and sane date boundaries.
 */

export interface DateValidationResult {
  valid: boolean;
  error?: string;
  isoDate?: string;
}

/**
 * Returns dynamic sane date boundaries based on reference date:
 * - min: today minus 1 year
 * - max: today plus 5 years
 */
export function getSaneTripDateLimits(referenceDate = new Date()): { min: string; max: string } {
  const minDate = new Date(referenceDate);
  minDate.setFullYear(minDate.getFullYear() - 1);
  const maxDate = new Date(referenceDate);
  maxDate.setFullYear(maxDate.getFullYear() + 5);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    min: format(minDate),
    max: format(maxDate),
  };
}

/**
 * Formats ISO string (YYYY-MM-DD) to display format (DD/MM/YYYY).
 */
export function formatIsoToDisplay(iso: string): string {
  if (!iso) return '';
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/**
 * Checks if a year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in a given month and year.
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  // Months with 30 days: April (4), June (6), September (9), November (11)
  if ([4, 6, 9, 11].includes(month)) return 30;
  // February
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  // All others have 31
  return 31;
}

/**
 * Parses and strictly validates a date string in DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD.
 * Rejects impossible calendar dates (e.g. 30-02, 31-02, 31-04, 29-02 non-leap).
 * Rejects non-4-digit years.
 */
export function parseAndValidateDate(input: string): DateValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a valid date.' };
  }

  let day: number;
  let month: number;
  let year: number;
  let rawYearStr: string;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d+)$/);
  // YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d+)-(\d{1,2})-(\d{1,2})$/);

  if (dmyMatch) {
    day = parseInt(dmyMatch[1]!, 10);
    month = parseInt(dmyMatch[2]!, 10);
    rawYearStr = dmyMatch[3]!;
    year = parseInt(rawYearStr, 10);
  } else if (ymdMatch) {
    rawYearStr = ymdMatch[1]!;
    year = parseInt(rawYearStr, 10);
    month = parseInt(ymdMatch[2]!, 10);
    day = parseInt(ymdMatch[3]!, 10);
  } else {
    return { valid: false, error: 'Please enter a valid date.' };
  }

  // 1. Enforce 4-digit year
  if (rawYearStr.length !== 4 || year < 1000 || year > 9999) {
    return { valid: false, error: 'Year must be a 4-digit number.' };
  }

  // 2. Validate month
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month must be between 01 and 12.' };
  }

  // 3. Validate day exists in month & year (reject impossible dates)
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    return {
      valid: false,
      error: "Invalid date: this day doesn't exist in the selected month.",
    };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const isoDate = `${year}-${mm}-${dd}`;

  return { valid: true, isoDate };
}

/**
 * Backward compatible parser returning iso string or null.
 */
export function parseDateInput(input: string): string | null {
  const res = parseAndValidateDate(input);
  return res.valid && res.isoDate ? res.isoDate : null;
}

/**
 * Validates a trip date against sane limits (today - 1 yr to today + 5 yrs).
 */
export function validateTripDate(
  dateInput: string,
  referenceDate = new Date()
): DateValidationResult {
  const parsed = parseAndValidateDate(dateInput);
  if (!parsed.valid || !parsed.isoDate) return parsed;

  const { min, max } = getSaneTripDateLimits(referenceDate);

  if (parsed.isoDate < min || parsed.isoDate > max) {
    return {
      valid: false,
      error: `Trip date must be between ${min} and ${max}.`,
      isoDate: parsed.isoDate,
    };
  }

  return { valid: true, isoDate: parsed.isoDate };
}

/**
 * Validates trip start and end date pair.
 */
export function validateTripDateRange(
  startDateInput?: string | null,
  endDateInput?: string | null,
  referenceDate = new Date()
): DateValidationResult {
  const s = startDateInput ? parseAndValidateDate(startDateInput) : null;
  const e = endDateInput ? parseAndValidateDate(endDateInput) : null;

  if (s && !s.valid) return s;
  if (e && !e.valid) return e;

  if (s?.isoDate) {
    const sCheck = validateTripDate(s.isoDate, referenceDate);
    if (!sCheck.valid) return sCheck;
  }

  if (e?.isoDate) {
    const eCheck = validateTripDate(e.isoDate, referenceDate);
    if (!eCheck.valid) return eCheck;
  }

  if (s?.isoDate && e?.isoDate && e.isoDate < s.isoDate) {
    return { valid: false, error: 'End date cannot be earlier than start date.' };
  }

  return { valid: true };
}

/**
 * Validates an expense date against the trip's start-end range.
 * If trip has no dates, falls back to sane limits (today - 1 year to today + 5 years).
 */
export function validateExpenseDate(
  spentOnInput: string,
  tripStartDate?: string | null,
  tripEndDate?: string | null,
  referenceDate = new Date()
): DateValidationResult {
  const parsed = parseAndValidateDate(spentOnInput);
  if (!parsed.valid || !parsed.isoDate) return parsed;

  const iso = parsed.isoDate;
  const s = tripStartDate ? parseDateInput(tripStartDate) : null;
  const e = tripEndDate ? parseDateInput(tripEndDate) : null;

  // If trip has both start and end date
  if (s && e) {
    if (iso < s || iso > e) {
      const msg =
        s === e
          ? `Expense date must be ${s}.`
          : `Expense date must be between ${s} and ${e}.`;
      return { valid: false, error: msg, isoDate: iso };
    }
    return { valid: true, isoDate: iso };
  }

  // If trip has only start date
  if (s && !e) {
    const { max } = getSaneTripDateLimits(referenceDate);
    if (iso < s) {
      return {
        valid: false,
        error: `Expense date must be on or after ${s}.`,
        isoDate: iso,
      };
    }
    if (iso > max) {
      return {
        valid: false,
        error: `Expense date cannot be more than 5 years in the future (${max}).`,
        isoDate: iso,
      };
    }
    return { valid: true, isoDate: iso };
  }

  // If trip has only end date
  if (!s && e) {
    const { min } = getSaneTripDateLimits(referenceDate);
    if (iso > e) {
      return {
        valid: false,
        error: `Expense date must be on or before ${e}.`,
        isoDate: iso,
      };
    }
    if (iso < min) {
      return {
        valid: false,
        error: `Expense date cannot be earlier than 1 year in the past (${min}).`,
        isoDate: iso,
      };
    }
    return { valid: true, isoDate: iso };
  }

  // Trip has no dates set: enforce sane limits
  const { min, max } = getSaneTripDateLimits(referenceDate);
  if (iso < min || iso > max) {
    return {
      valid: false,
      error: `Expense date must be between ${min} and ${max}.`,
      isoDate: iso,
    };
  }

  return { valid: true, isoDate: iso };
}
