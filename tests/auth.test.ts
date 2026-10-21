import { describe, it, expect } from 'vitest';
import { emailSchema, passwordSchema, displayNameSchema } from '@/lib/schemas/auth';
import { sanitizeNextUrl } from '@/lib/security';

describe('Authentication Validation and Logic', () => {
  describe('emailSchema', () => {
    it('accepts valid email addresses and transforms them to lowercase', () => {
      const res1 = emailSchema.safeParse('User@Example.com');
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.data).toBe('user@example.com');
      }

      const res2 = emailSchema.safeParse('  traveler.123+tag@gmail.com  ');
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.data).toBe('traveler.123+tag@gmail.com');
      }
    });

    it('rejects invalid email formats', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
      expect(emailSchema.safeParse('user@').success).toBe(false);
      expect(emailSchema.safeParse('').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('accepts passwords of 6 characters or more', () => {
      expect(passwordSchema.safeParse('123456').success).toBe(true);
      expect(passwordSchema.safeParse('secure_pass_word').success).toBe(true);
      expect(passwordSchema.safeParse('superlongpasswordwithsymbols!@#').success).toBe(true);
    });

    it('rejects passwords shorter than 6 characters', () => {
      const result = passwordSchema.safeParse('12345');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('at least 6 characters');
      }
      expect(passwordSchema.safeParse('').success).toBe(false);
    });
  });

  describe('displayNameSchema', () => {
    it('accepts valid display names between 1 and 60 characters', () => {
      expect(displayNameSchema.safeParse('Anannya').success).toBe(true);
      expect(displayNameSchema.safeParse('Rohan Mehta').success).toBe(true);
      expect(displayNameSchema.safeParse('a'.repeat(60)).success).toBe(true);
    });

    it('trims whitespace and rejects empty names or names longer than 60 chars', () => {
      expect(displayNameSchema.safeParse('').success).toBe(false);
      expect(displayNameSchema.safeParse('   ').success).toBe(false);
      expect(displayNameSchema.safeParse('a'.repeat(61)).success).toBe(false);
    });
  });

  describe('sanitizeNextUrl', () => {
    it('preserves valid relative paths', () => {
      expect(sanitizeNextUrl('/trips')).toBe('/trips');
      expect(sanitizeNextUrl('/trips/123-abc/expenses/new')).toBe('/trips/123-abc/expenses/new');
      expect(sanitizeNextUrl('/profile')).toBe('/profile');
    });

    it('prevents open redirect attacks by defaulting to /trips', () => {
      expect(sanitizeNextUrl('https://evil.com')).toBe('/trips');
      expect(sanitizeNextUrl('//evil.com')).toBe('/trips');
      expect(sanitizeNextUrl('javascript:alert(1)')).toBe('/trips');
      expect(sanitizeNextUrl(null)).toBe('/trips');
      expect(sanitizeNextUrl(undefined)).toBe('/trips');
    });
  });
});
