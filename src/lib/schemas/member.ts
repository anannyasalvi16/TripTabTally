import { z } from 'zod';

export const placeholderSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Name must be at least 1 character.')
    .max(60, 'Name cannot exceed 60 characters.'),
  email: z
    .string()
    .trim()
    .email('Invalid email address.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\- ]{7,20}$/, 'Invalid phone number format.')
    .optional()
    .or(z.literal('')),
  familyId: z.string().uuid().optional().or(z.literal('')).nullable(),
});

export const manualMemberSchema = placeholderSchema;

export const familySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Family name is required.')
    .max(60, 'Family name cannot exceed 60 characters.'),
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

