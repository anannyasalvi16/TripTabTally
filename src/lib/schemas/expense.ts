import { z } from 'zod';
import { parseAndValidateDate } from './date-utils';

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
  spentOn: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      const res = parseAndValidateDate(val);
      if (!res.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error || 'Please enter a valid date.',
        });
      }
    }),
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

export {
  formatIsoToDisplay,
  parseDateInput,
  parseAndValidateDate,
  validateExpenseDate,
  getSaneTripDateLimits,
  getDaysInMonth,
  isLeapYear,
} from './date-utils';
