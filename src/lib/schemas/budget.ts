import { z } from 'zod';
import { expenseCategories } from './expense';

export const updateBudgetSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID'),
  budgetRupees: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[0-9]+(\.[0-9]{1,2})?$/.test(val),
      'Budget must be a positive number with up to 2 decimal places'
    ),
});

export const updateCategoryLimitSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID'),
  category: z.enum(expenseCategories, {
    errorMap: () => ({ message: 'Invalid category' }),
  }),
  limitRupees: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[0-9]+(\.[0-9]{1,2})?$/.test(val),
      'Limit must be a positive number with up to 2 decimal places'
    ),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type UpdateCategoryLimitInput = z.infer<typeof updateCategoryLimitSchema>;
