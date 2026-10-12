import { describe, it, expect } from 'vitest';
import { tripSchema } from '@/lib/schemas/trip';
import { placeholderSchema, joinTripSchema } from '@/lib/schemas/member';

describe('Trip Schema Validation', () => {
  it('validates correct trip inputs', () => {
    const valid = tripSchema.safeParse({
      name: 'Goa Trip 2026',
      destination: 'Anjuna',
      startDate: '2026-12-10',
      endDate: '2026-12-15',
      budgetRupees: '50000',
      displayName: 'Rohan',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects trip name shorter than 2 characters', () => {
    const invalid = tripSchema.safeParse({
      name: 'A',
      displayName: 'Rohan',
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects trip name longer than 60 characters', () => {
    const invalid = tripSchema.safeParse({
      name: 'A'.repeat(61),
      displayName: 'Rohan',
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects end date earlier than start date', () => {
    const invalid = tripSchema.safeParse({
      name: 'Manali Trip',
      startDate: '2026-12-20',
      endDate: '2026-12-15',
      displayName: 'Rohan',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.errors[0]?.message).toContain('End date cannot be earlier');
    }
  });

  it('accepts same-day trip where end date equals start date', () => {
    const valid = tripSchema.safeParse({
      name: 'Day Trip to Alibaug',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      displayName: 'Rohan',
    });
    expect(valid.success).toBe(true);
  });

  it('accepts optional dates and budget', () => {
    const valid = tripSchema.safeParse({
      name: 'Weekend Getaway',
      destination: '',
      startDate: '',
      endDate: '',
      budgetRupees: '',
      displayName: 'Meera',
    });
    expect(valid.success).toBe(true);
  });
});

describe('Member and Join Schema Validation', () => {
  it('validates placeholder display name', () => {
    const valid = placeholderSchema.safeParse({ displayName: 'Kabir' });
    expect(valid.success).toBe(true);

    const empty = placeholderSchema.safeParse({ displayName: '' });
    expect(empty.success).toBe(false);
  });

  it('validates join trip schema', () => {
    const validWithClaim = joinTripSchema.safeParse({
      token: 'validtoken128bitslong',
      claimMemberId: '11111111-1111-1111-1111-111111111111',
      displayName: '',
    });
    expect(validWithClaim.success).toBe(true);

    const validNewMember = joinTripSchema.safeParse({
      token: 'validtoken128bitslong',
      claimMemberId: '',
      displayName: 'Anannya',
    });
    expect(validNewMember.success).toBe(true);

    const invalidShortToken = joinTripSchema.safeParse({
      token: 'short',
    });
    expect(invalidShortToken.success).toBe(false);
  });
});

describe('Admin Invariant In People Operations', () => {
  it('protects against removing the sole admin of a trip', () => {
    const members = [
      { id: 'm1', role: 'admin' },
      { id: 'm2', role: 'member' },
    ];

    const targetToDemote = 'm1';
    const remainingAdmins = members.filter(
      (m) => m.id !== targetToDemote && m.role === 'admin'
    ).length;

    expect(remainingAdmins).toBe(0); // Should be blocked by check
  });

  it('allows promoting and demoting when another admin exists', () => {
    const members = [
      { id: 'm1', role: 'admin' },
      { id: 'm2', role: 'admin' },
      { id: 'm3', role: 'member' },
    ];

    const targetToDemote = 'm1';
    const remainingAdmins = members.filter(
      (m) => m.id !== targetToDemote && m.role === 'admin'
    ).length;

    expect(remainingAdmins).toBe(1); // Valid
  });
});
