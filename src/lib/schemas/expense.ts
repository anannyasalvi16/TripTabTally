import { z } from 'zod';

export const expenseCategories = [
  'stay',
  'food',
  'transport',
  'activities',
  'shopping',
  'other',
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export const splitTypes = ['equal', 'exact', 'percent', 'shares'] as const;
export type SplitType = (typeof splitTypes)[number];

export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(80, 'Title cannot exceed 80 characters.'),
  amountRupees: z
    .string()
    .trim()
    .min(1, 'Amount is required.'),
  category: z.enum(expenseCategories, {
    errorMap: () => ({ message: 'Please select a valid category.' }),
  }),
  paidBy: z.string().uuid('Please select who paid.'),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date.'),
  note: z
    .string()
    .trim()
    .max(300, 'Note cannot exceed 300 characters.')
    .optional()
    .or(z.literal('')),
  splitType: z.enum(splitTypes),
  // splitInput captures the raw configuration (e.g. which members for equal, entered amounts/percentages)
  splitInput: z.record(z.any()),
  version: z.number().int().optional(),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

export function formatIsoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function parseDateInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]!, 10);
    const month = parseInt(dmyMatch[2]!, 10);
    const year = parseInt(dmyMatch[3]!, 10);

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return null;

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1]!, 10);
    const month = parseInt(ymdMatch[2]!, 10);
    const day = parseInt(ymdMatch[3]!, 10);
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return null;
    return trimmed;
  }

  return null;
}

export function validateExpenseDate(
  spentOn: string,
  startDate?: string | null,
  endDate?: string | null
): { valid: boolean; error?: string } {
  if (!spentOn) {
    return { valid: false, error: 'Please enter a valid date.' };
  }

  const normalized = parseDateInput(spentOn) || spentOn;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return { valid: false, error: 'Please enter a valid date.' };
  }
  if (startDate && endDate) {
    if (normalized < startDate || normalized > endDate) {
      const msg =
        startDate === endDate
          ? `Expense date must be ${startDate}.`
          : `Expense date must be between ${startDate} and ${endDate}.`;
      return { valid: false, error: msg };
    }
  } else if (startDate && normalized < startDate) {
    return {
      valid: false,
      error: `Expense date must be on or after ${startDate}.`,
    };
  } else if (endDate && normalized > endDate) {
    return {
      valid: false,
      error: `Expense date must be on or before ${endDate}.`,
    };
  }
  return { valid: true };
}
