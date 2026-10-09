import { z } from 'zod';

export const placeholderSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Name must be at least 1 character.')
    .max(60, 'Name cannot exceed 60 characters.'),
});

export const joinTripSchema = z.object({
  token: z.string().min(10, 'Invalid invite token.'),
  claimMemberId: z.string().uuid().optional().or(z.literal('')),
  displayName: z
    .string()
    .trim()
    .max(60, 'Name cannot exceed 60 characters.')
    .optional()
    .or(z.literal('')),
});
