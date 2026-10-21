import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name cannot be empty.')
  .max(60, 'Display name must be 60 characters or fewer.');
