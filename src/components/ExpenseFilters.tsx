'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { expenseCategories } from '@/lib/schemas/expense';

interface Member {
  id: string;
  display_name: string;
}

interface ExpenseFiltersProps {
  members: Member[];
}

export function ExpenseFilters({ members }: ExpenseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category') || '';
  const currentPayer = searchParams.get('payer') || '';
  const currentSort = searchParams.get('sort') || 'date_desc';

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(currentCategory || currentPayer || currentSort !== 'date_desc');

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 border-b border-rule text-xs">
      {/* Category Filter */}
      <select
        aria-label="Filter expenses by category"
        value={currentCategory}
        onChange={(e) => updateFilter('category', e.target.value)}
        className="border border-rule bg-paper-2 px-2.5 py-1 text-xs text-ink focus:border-brick capitalize"
      >
        <option value="">All categories</option>
        {expenseCategories.map((c) => (
          <option key={c} value={c} className="capitalize">
            {c}
          </option>
        ))}
      </select>

      {/* Payer Filter */}
      <select
        aria-label="Filter expenses by payer"
        value={currentPayer}
        onChange={(e) => updateFilter('payer', e.target.value)}
        className="border border-rule bg-paper-2 px-2.5 py-1 text-xs text-ink focus:border-brick"
      >
        <option value="">All payers</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>

      {/* Sorting */}
      <select
        aria-label="Sort expenses"
        value={currentSort}
        onChange={(e) => updateFilter('sort', e.target.value)}
        className="border border-rule bg-paper-2 px-2.5 py-1 text-xs text-ink focus:border-brick"
      >
        <option value="date_desc">Newest date</option>
        <option value="date_asc">Oldest date</option>
        <option value="amount_desc">Highest amount</option>
        <option value="amount_asc">Lowest amount</option>
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-brick hover:underline px-2 py-1 text-xs"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}
