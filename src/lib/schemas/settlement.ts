import { z } from 'zod';

export const settlementSchema = z
  .object({
    tripId: z.string().uuid('Invalid trip ID'),
    fromMember: z.string().uuid('Please select who paid'),
    toMember: z.string().uuid('Please select who received'),
    amountRupees: z
      .string()
      .trim()
      .min(1, 'Amount is required')
      .refine(
        (val) => /^[0-9]+(\.[0-9]{1,2})?$/.test(val),
        'Amount must be a positive number with up to 2 decimal places'
      ),
    paidOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
      .default(() => new Date().toISOString().split('T')[0]),
    note: z.string().max(200, 'Note cannot exceed 200 characters').optional(),
  })
  .refine((data) => data.fromMember !== data.toMember, {
    message: 'Payer and receiver must be different members',
    path: ['toMember'],
  });

export type SettlementInput = z.infer<typeof settlementSchema>;
