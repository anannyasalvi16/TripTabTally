import type { Paise, Result } from './types';
import { formatPaise } from './format';

/**
 * Deterministic 32-bit FNV-1a hash function for rotating equal splits by seed.
 */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Equal split: divides total into base amount and remainder paise.
 * Members are sorted by ID, rotated by hash(seed) % n, and the first remainder
 * people each receive 1 extra paisa.
 */
export function splitEqual(
  total: Paise,
  memberIds: string[],
  seed: string = ''
): Record<string, Paise> {
  const n = memberIds.length;
  if (n === 0) return {};

  const totalPaise = Math.max(0, Math.round(total));
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise % n;

  // Stable sort by ID
  const sorted = [...memberIds].sort();

  // Rotate list by deterministic hash of seed
  const rotation = hashSeed(seed) % n;
  const rotated = [...sorted.slice(rotation), ...sorted.slice(0, rotation)];

  const result: Record<string, Paise> = {};
  for (let i = 0; i < n; i++) {
    const memberId = rotated[i];
    if (memberId) {
      result[memberId] = base + (i < remainder ? 1 : 0);
    }
  }

  return result;
}

/**
 * Exact split: verifies entered amounts sum to total.
 */
export function splitExact(
  total: Paise,
  amounts: Record<string, Paise>
): Result<Record<string, Paise>> {
  const totalPaise = Math.round(total);
  const result: Record<string, Paise> = {};
  let currentSum = 0;

  for (const [id, amount] of Object.entries(amounts)) {
    const rounded = Math.round(amount);
    if (rounded < 0) {
      return { ok: false, error: 'Individual share amounts cannot be negative.' };
    }
    result[id] = rounded;
    currentSum += rounded;
  }

  const diff = totalPaise - currentSum;
  if (diff > 0) {
    const diffFormatted = formatPaise(diff);
    return {
      ok: false,
      differencePaise: diff,
      error: `${diffFormatted} is not assigned to anyone yet.`,
    };
  }

  if (diff < 0) {
    const diffFormatted = formatPaise(Math.abs(diff));
    return {
      ok: false,
      differencePaise: diff,
      error: `Assigned amounts exceed total by ${diffFormatted}.`,
    };
  }

  return { ok: true, data: result };
}

/**
 * Percentage split using the Largest Remainder Method (Hare-Niemeyer method).
 * Guarantees shares sum to exactly total paise.
 */
export function splitPercent(
  total: Paise,
  percentages: Record<string, number>
): Result<Record<string, Paise>> {
  const memberIds = Object.keys(percentages);
  if (memberIds.length === 0) {
    return { ok: true, data: {} };
  }

  let totalPercent = 0;
  for (const id of memberIds) {
    const pct = percentages[id] ?? 0;
    if (pct < 0) {
      return { ok: false, error: 'Percentages cannot be negative.' };
    }
    totalPercent += pct;
  }

  // Check sum is 100 within a tiny epsilon for float inputs like 33.33 + 33.33 + 33.34
  if (Math.abs(totalPercent - 100) > 0.01) {
    return {
      ok: false,
      error: `Percentages add up to ${totalPercent.toFixed(2)}. They need to add up to 100.`,
    };
  }

  const totalPaise = Math.round(total);
  const items: Array<{ id: string; floorPaise: number; remainder: number }> = [];
  let assignedPaise = 0;

  for (const id of memberIds) {
    const pct = percentages[id] ?? 0;
    const rawShare = (totalPaise * pct) / 100;
    const floorPaise = Math.floor(rawShare);
    const remainder = rawShare - floorPaise;
    assignedPaise += floorPaise;
    items.push({ id, floorPaise, remainder });
  }

  let leftover = totalPaise - assignedPaise;

  // Sort by remainder descending, tie-break by ID ascending
  items.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.id.localeCompare(b.id);
  });

  const result: Record<string, Paise> = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) {
      const extra = leftover > 0 ? 1 : 0;
      if (leftover > 0) leftover--;
      result[item.id] = item.floorPaise + extra;
    }
  }

  return { ok: true, data: result };
}

/**
 * Shares split using the Largest Remainder Method based on numerical weights.
 * Supports positive decimals (e.g. adults 1, kids 0.5).
 */
export function splitShares(
  total: Paise,
  shares: Record<string, number>
): Result<Record<string, Paise>> {
  const memberIds = Object.keys(shares);
  if (memberIds.length === 0) {
    return { ok: true, data: {} };
  }

  let totalShares = 0;
  for (const id of memberIds) {
    const share = shares[id] ?? 0;
    if (share <= 0 || isNaN(share) || !isFinite(share)) {
      return { ok: false, error: 'Share counts must be positive numbers.' };
    }
    totalShares += share;
  }

  if (totalShares === 0) {
    return { ok: false, error: 'Total shares must be greater than zero.' };
  }

  const totalPaise = Math.round(total);
  const items: Array<{ id: string; floorPaise: number; remainder: number }> = [];
  let assignedPaise = 0;

  for (const id of memberIds) {
    const share = shares[id] ?? 0;
    const rawShare = (totalPaise * share) / totalShares;
    const floorPaise = Math.floor(rawShare);
    const remainder = rawShare - floorPaise;
    assignedPaise += floorPaise;
    items.push({ id, floorPaise, remainder });
  }

  let leftover = totalPaise - assignedPaise;

  // Sort by remainder descending, tie-break by ID ascending
  items.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.id.localeCompare(b.id);
  });

  const result: Record<string, Paise> = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) {
      const extra = leftover > 0 ? 1 : 0;
      if (leftover > 0) leftover--;
      result[item.id] = item.floorPaise + extra;
    }
  }

  return { ok: true, data: result };
}

export interface FamilySplitMemberInput {
  id: string;
  familyId?: string | null;
}

/**
 * Equally per family split:
 * Each participating family (and solo member acting as a 1-person unit) pays 1 equal share,
 * divided equally among its participating members.
 * Guarantees exact total paise with no rounding error.
 */
export function splitFamily(
  total: Paise,
  members: FamilySplitMemberInput[],
  participatingMemberIds: string[],
  seed: string = ''
): Result<{
  memberShares: Record<string, Paise>;
  familyShares: Record<string, Paise>;
}> {
  const activeIds = new Set(participatingMemberIds);
  const activeMembers = members.filter((m) => activeIds.has(m.id));

  if (activeMembers.length === 0) {
    return { ok: false, error: 'Select at least one member or family to split with.' };
  }

  // Group active members by family unit (solo members are their own 1-person unit)
  const unitToMembers = new Map<string, string[]>();
  for (const m of activeMembers) {
    const unitKey = m.familyId ? `fam:${m.familyId}` : `solo:${m.id}`;
    const list = unitToMembers.get(unitKey) || [];
    list.push(m.id);
    unitToMembers.set(unitKey, list);
  }

  const unitKeys = Array.from(unitToMembers.keys());
  // Divide total equally among participating units
  const unitShares = splitEqual(total, unitKeys, seed);

  const memberShares: Record<string, Paise> = {};
  const familyShares: Record<string, Paise> = {};

  for (const [unitKey, unitPaise] of Object.entries(unitShares)) {
    const memberList = unitToMembers.get(unitKey) || [];
    if (memberList.length === 0) continue;

    // Divide unit's share equally among its members
    const subShares = splitEqual(unitPaise, memberList, `${seed}:${unitKey}`);
    for (const [mid, paise] of Object.entries(subShares)) {
      memberShares[mid] = paise;
    }

    if (unitKey.startsWith('fam:')) {
      const famId = unitKey.replace('fam:', '');
      familyShares[famId] = (familyShares[famId] || 0) + unitPaise;
    } else {
      familyShares[unitKey] = unitPaise;
    }
  }

  return {
    ok: true,
    data: {
      memberShares,
      familyShares,
    },
  };
}
