import { z } from 'zod';
import { validateTripDate, parseDateInput } from './date-utils';

export const tripSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Trip name must be at least 2 characters.')
      .max(60, 'Trip name cannot exceed 60 characters.'),
    destination: z
      .string()
      .trim()
      .max(80, 'Destination cannot exceed 80 characters.')
      .optional()
      .or(z.literal('')),
    startDate: z
      .string()
      .optional()
      .or(z.literal(''))
      .superRefine((val, ctx) => {
        if (!val || !val.trim()) return;
        const res = validateTripDate(val);
        if (!res.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: res.error || 'Invalid start date.',
          });
        }
      }),
    endDate: z
      .string()
      .optional()
      .or(z.literal(''))
      .superRefine((val, ctx) => {
        if (!val || !val.trim()) return;
        const res = validateTripDate(val);
        if (!res.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: res.error || 'Invalid end date.',
          });
        }
      }),
    budgetRupees: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val) return true;
          const num = Number(val.replace(/,/g, ''));
          return !isNaN(num) && num > 0 && num <= 10000000;
        },
        { message: 'Budget must be a positive number up to ₹1,00,00,000.' }
      ),
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required.')
      .max(60, 'Display name cannot exceed 60 characters.'),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const s = parseDateInput(data.startDate);
        const e = parseDateInput(data.endDate);
        if (s && e) {
          return e >= s;
        }
      }
      return true;
    },
    {
      message: 'End date cannot be earlier than start date.',
      path: ['endDate'],
    }
  );

export type TripInput = z.infer<typeof tripSchema>;
