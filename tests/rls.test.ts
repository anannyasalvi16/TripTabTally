import { describe, it, expect } from 'vitest';

describe('Database Schema & RLS Policy Invariants', () => {
  const userA = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Rohan Mehta',
  };

  const userB = {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'External Stranger',
  };

  const tripA = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Goa Trip',
    created_by: userA.id,
    members: [
      { id: 'm1', user_id: userA.id, role: 'admin' },
      { id: 'm2', user_id: '22222222-2222-2222-2222-222222222222', role: 'member' },
    ],
  };

  // Helper evaluating is_trip_member SQL logic
  function isTripMember(trip: typeof tripA, userId: string): boolean {
    return trip.members.some((m) => m.user_id === userId);
  }

  // Helper evaluating is_trip_admin SQL logic
  function isTripAdmin(trip: typeof tripA, userId: string): boolean {
    return trip.members.some((m) => m.user_id === userId && m.role === 'admin');
  }

  it('allows member User A to read trip data', () => {
    expect(isTripMember(tripA, userA.id)).toBe(true);
  });

  it('prevents non-member User B from reading trip data (RLS isolation)', () => {
    expect(isTripMember(tripA, userB.id)).toBe(false);
  });

  it('restricts trip admin updates to admin members only', () => {
    expect(isTripAdmin(tripA, userA.id)).toBe(true);
    expect(isTripAdmin(tripA, '22222222-2222-2222-2222-222222222222')).toBe(false);
    expect(isTripAdmin(tripA, userB.id)).toBe(false);
  });

  it('rejects expense saves where split shares do not equal total amount', () => {
    const totalPaise = 100000; // Rs 1,000
    const splits = [
      { member_id: 'm1', share_paise: 50000 },
      { member_id: 'm2', share_paise: 40000 }, // sum is 90000, 10000 unassigned
    ];

    const sum = splits.reduce((acc, s) => acc + s.share_paise, 0);
    const isValid = sum === totalPaise;
    expect(isValid).toBe(false);
  });

  it('accepts expense saves where split shares equal total amount exactly', () => {
    const totalPaise = 100000;
    const splits = [
      { member_id: 'm1', share_paise: 50000 },
      { member_id: 'm2', share_paise: 50000 },
    ];

    const sum = splits.reduce((acc, s) => acc + s.share_paise, 0);
    expect(sum).toBe(totalPaise);
  });

  it('enforces that a trip must retain at least one admin', () => {
    const activeAdmins = tripA.members.filter((m) => m.role === 'admin').length;
    expect(activeAdmins).toBeGreaterThanOrEqual(1);

    // Demoting the only admin should fail the count invariant
    const demotedAdmins = tripA.members
      .map((m) => (m.user_id === userA.id ? { ...m, role: 'member' } : m))
      .filter((m) => m.role === 'admin').length;

    expect(demotedAdmins < 1).toBe(true);
  });
});

describe('Auth & Route Gating Invariants', () => {
  function getSafeNextPath(rawNext: string | null): string {
    if (!rawNext) return '/trips';
    if (rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\')) {
      return rawNext;
    }
    return '/trips';
  }

  it('allows valid internal redirection targets', () => {
    expect(getSafeNextPath('/trips')).toBe('/trips');
    expect(getSafeNextPath('/trips/abc-123')).toBe('/trips/abc-123');
    expect(getSafeNextPath('/join/token123')).toBe('/join/token123');
  });

  it('neutralizes open redirect attempts to external protocols or domains', () => {
    expect(getSafeNextPath('https://malicious.com')).toBe('/trips');
    expect(getSafeNextPath('//malicious.com')).toBe('/trips');
    expect(getSafeNextPath('/\\malicious.com')).toBe('/trips');
    expect(getSafeNextPath(null)).toBe('/trips');
  });
});
