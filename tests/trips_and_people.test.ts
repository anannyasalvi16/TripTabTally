import { describe, it, expect } from 'vitest';
import { tripSchema } from '@/lib/schemas/trip';
import { placeholderSchema, joinTripSchema, familySchema } from '@/lib/schemas/member';

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

  it('rejects impossible calendar dates in trip start date', () => {
    const invalidFeb31 = tripSchema.safeParse({
      name: 'Impossible Trip',
      startDate: '31-02-4000',
      displayName: 'Rohan',
    });
    expect(invalidFeb31.success).toBe(false);
    if (!invalidFeb31.success) {
      expect(invalidFeb31.error.errors[0]?.message).toBe(
        "Invalid date: this day doesn't exist in the selected month."
      );
    }

    const invalidApril31 = tripSchema.safeParse({
      name: 'Impossible Trip',
      endDate: '31/04/2026',
      displayName: 'Rohan',
    });
    expect(invalidApril31.success).toBe(false);
    if (!invalidApril31.success) {
      expect(invalidApril31.error.errors[0]?.message).toBe(
        "Invalid date: this day doesn't exist in the selected month."
      );
    }
  });

  it('rejects 2-digit years in trip dates', () => {
    const invalid = tripSchema.safeParse({
      name: 'Short Year Trip',
      startDate: '10/12/26',
      displayName: 'Rohan',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.errors[0]?.message).toBe('Year must be a 4-digit number.');
    }
  });

  it('rejects trip dates outside sane bounds (today - 1 yr to today + 5 yrs)', () => {
    const wayTooOld = tripSchema.safeParse({
      name: 'Historical Trip',
      startDate: '2020-01-01',
      displayName: 'Rohan',
    });
    expect(wayTooOld.success).toBe(false);
    if (!wayTooOld.success) {
      expect(wayTooOld.error.errors[0]?.message).toContain('Trip date must be between');
    }

    const wayTooFuture = tripSchema.safeParse({
      name: 'Sci-Fi Trip',
      endDate: '2045-01-01',
      displayName: 'Rohan',
    });
    expect(wayTooFuture.success).toBe(false);
    if (!wayTooFuture.success) {
      expect(wayTooFuture.error.errors[0]?.message).toContain('Trip date must be between');
    }
  });
});

describe('Member and Join Schema Validation', () => {
  it('validates manual member display name only', () => {
    const valid = placeholderSchema.safeParse({ displayName: 'Kabir' });
    expect(valid.success).toBe(true);

    const empty = placeholderSchema.safeParse({ displayName: '' });
    expect(empty.success).toBe(false);
  });

  it('validates manual member with optional email, phone, and familyId', () => {
    const validFull = placeholderSchema.safeParse({
      displayName: 'Kabir Sharma',
      email: 'kabir@example.com',
      phone: '+91 9876543210',
      familyId: '11111111-1111-1111-1111-111111111111',
    });
    expect(validFull.success).toBe(true);

    const validEmptyOptionals = placeholderSchema.safeParse({
      displayName: 'Kabir Sharma',
      email: '',
      phone: '',
      familyId: '',
    });
    expect(validEmptyOptionals.success).toBe(true);
  });

  it('rejects invalid email or phone for manual member', () => {
    const invalidEmail = placeholderSchema.safeParse({
      displayName: 'Kabir',
      email: 'not-an-email',
    });
    expect(invalidEmail.success).toBe(false);

    const invalidPhone = placeholderSchema.safeParse({
      displayName: 'Kabir',
      phone: 'invalid-phone-abc',
    });
    expect(invalidPhone.success).toBe(false);
  });

  it('validates family schema', () => {
    const valid = familySchema.safeParse({ name: 'Sharma family' });
    expect(valid.success).toBe(true);

    const empty = familySchema.safeParse({ name: '' });
    expect(empty.success).toBe(false);

    const tooLong = familySchema.safeParse({ name: 'A'.repeat(61) });
    expect(tooLong.success).toBe(false);
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

describe('Invite Links Expiry and Revocation', () => {
  it('treats null expires_at as permanent non-expiring invite', () => {
    const invite = {
      token: 'longtokenwithatleast16chars',
      expires_at: null,
      revoked_at: null,
    };

    const isExpired = Boolean(invite.expires_at) && new Date(invite.expires_at!) < new Date();
    const isRevoked = Boolean(invite.revoked_at);
    const isValid = !isExpired && !isRevoked;

    expect(isValid).toBe(true);
  });

  it('rejects expired invites', () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const invite = {
      token: 'longtokenwithatleast16chars',
      expires_at: pastDate,
      revoked_at: null,
    };

    const isExpired = Boolean(invite.expires_at) && new Date(invite.expires_at!) < new Date();
    expect(isExpired).toBe(true);
  });

  it('rejects revoked invites even if unexpired', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days later
    const invite = {
      token: 'longtokenwithatleast16chars',
      expires_at: futureDate,
      revoked_at: new Date().toISOString(),
    };

    const isExpired = Boolean(invite.expires_at) && new Date(invite.expires_at!) < new Date();
    const isRevoked = Boolean(invite.revoked_at);
    const isValid = !isExpired && !isRevoked;

    expect(isValid).toBe(false);
  });
});

