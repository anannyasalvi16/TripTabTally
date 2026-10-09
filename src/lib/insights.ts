import type { Paise } from './money/types';
import { formatPaise } from './money/format';

export interface CategorySpend {
  category: string;
  spentPaise: Paise;
  limitPaise?: Paise | null;
}

export interface MemberSpend {
  displayName: string;
  paidPaise: Paise;
}

export interface TripPaceData {
  totalSpentPaise: Paise;
  budgetPaise?: Paise | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  currentDate?: string; // YYYY-MM-DD, optional override for testing
}

export interface InsightInput {
  categories: CategorySpend[];
  members: MemberSpend[];
  pace?: TripPaceData;
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Computes difference in calendar days between two YYYY-MM-DD dates inclusive.
 */
export function getDaysCount(start: string, end: string): number {
  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diffDays, 1);
}

/**
 * Generates template-based insight sentences according to TRD Section 9:
 * 1. Over-limit category: `{Category} is {amount} over its limit of {limit}.`
 * 2. Largest category: `{Category} is {pct}% of what you have spent so far.`
 * 3. Pace (needs budget and dates): `You are spending {perDay} a day against {plannedPerDay} planned.`
 * 4. Biggest payer: `{Name} has paid {amount}, which is {pct}% of all spending.`
 *
 * Up to four sentences returned, only when justified by numbers.
 */
export function generateInsights(input: InsightInput): string[] {
  const insights: string[] = [];

  const totalSpentPaise = input.categories.reduce(
    (sum, c) => sum + (c.spentPaise > 0 ? c.spentPaise : 0),
    0
  );

  // 1. Over-limit categories (take the largest overage if multiple, or list them)
  const overLimit = input.categories
    .filter((c) => c.limitPaise && c.spentPaise > c.limitPaise)
    .sort((a, b) => {
      const overA = a.spentPaise - (a.limitPaise ?? 0);
      const overB = b.spentPaise - (b.limitPaise ?? 0);
      return overB - overA;
    });

function fmt(paise: Paise): string {
  return formatPaise(paise, { showZeroDecimals: false });
}

  if (overLimit.length > 0) {
    const firstOver = overLimit[0];
    const diff = firstOver.spentPaise - (firstOver.limitPaise ?? 0);
    insights.push(
      `${capitalize(firstOver.category)} is ${fmt(diff)} over its limit of ${fmt(firstOver.limitPaise!)}.`
    );
  }

  // 2. Largest category
  if (totalSpentPaise > 0 && input.categories.length > 0) {
    const sortedCats = [...input.categories].sort((a, b) => b.spentPaise - a.spentPaise);
    const topCat = sortedCats[0];
    if (topCat && topCat.spentPaise > 0) {
      const pct = Math.round((topCat.spentPaise / totalSpentPaise) * 100);
      insights.push(
        `${capitalize(topCat.category)} is ${pct}% of what you have spent so far.`
      );
    }
  }

  // 3. Pace (needs budget and dates)
  if (
    input.pace &&
    input.pace.budgetPaise &&
    input.pace.budgetPaise > 0 &&
    input.pace.startDate &&
    input.pace.endDate
  ) {
    const totalDays = getDaysCount(input.pace.startDate, input.pace.endDate);
    const plannedPerDayPaise = Math.round(input.pace.budgetPaise / totalDays);

    const todayStr =
      input.pace.currentDate || new Date().toISOString().split('T')[0];

    // Calculate elapsed days
    let elapsedDays = 1;
    if (todayStr < input.pace.startDate) {
      elapsedDays = 1;
    } else if (todayStr > input.pace.endDate) {
      elapsedDays = totalDays;
    } else {
      elapsedDays = getDaysCount(input.pace.startDate, todayStr);
    }

    elapsedDays = Math.min(Math.max(elapsedDays, 1), totalDays);
    const perDayPaise = Math.round(input.pace.totalSpentPaise / elapsedDays);

    insights.push(
      `You are spending ${fmt(perDayPaise)} a day against ${fmt(plannedPerDayPaise)} planned.`
    );
  }

  // 4. Biggest payer
  if (totalSpentPaise > 0 && input.members.length > 0) {
    const sortedMembers = [...input.members].sort((a, b) => b.paidPaise - a.paidPaise);
    const topPayer = sortedMembers[0];
    if (topPayer && topPayer.paidPaise > 0) {
      const pct = Math.round((topPayer.paidPaise / totalSpentPaise) * 100);
      insights.push(
        `${topPayer.displayName} has paid ${fmt(topPayer.paidPaise)}, which is ${pct}% of all spending.`
      );
    }
  }

  return insights.slice(0, 4);
}
