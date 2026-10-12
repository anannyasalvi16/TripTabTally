'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createTripAction, type TripActionResult } from '@/actions/trips';

export default function NewTripPage() {
  const [state, formAction, isPending] = useActionState<TripActionResult | null, FormData>(
    createTripAction,
    null
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);

  return (
    <div className="px-4 py-8 sm:px-8 max-w-form mx-auto">
      <div className="border-b border-rule pb-4 mb-6">
        <Link
          href="/trips"
          className="text-xs text-ink-2 hover:text-ink transition-colors block mb-2"
        >
          ← Back to trips
        </Link>
        <h1 className="font-serif text-3xl font-normal text-ink">
          New trip
        </h1>
        <p className="mt-1 text-xs text-ink-2">
          Create a shared ledger for your travel group.
        </p>
      </div>

      {state && !state.ok && state.message && (
        <div className="mb-6 p-3 border border-brick text-brick text-sm bg-paper-2">
          {state.message}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-ink mb-1">
            Trip name <span className="text-brick">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Goa Trip"
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
          />
          {state?.fieldErrors?.name && (
            <p className="mt-1 text-xs text-brick">{state.fieldErrors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="destination" className="block text-xs font-medium text-ink-2 mb-1">
            Destination (optional)
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            maxLength={80}
            placeholder="e.g. North Goa"
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
          />
          {state?.fieldErrors?.destination && (
            <p className="mt-1 text-xs text-brick">{state.fieldErrors.destination}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-xs font-medium text-ink-2 mb-1">
              Start date (optional)
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                const val = e.target.value;
                setStartDate(val);
                if (endDate && val && endDate < val) {
                  setEndDate(val);
                }
              }}
              className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink focus:border-brick"
            />
            {state?.fieldErrors?.startDate && (
              <p className="mt-1 text-xs text-brick">{state.fieldErrors.startDate}</p>
            )}
          </div>

          <div>
            <label htmlFor="endDate" className="block text-xs font-medium text-ink-2 mb-1">
              End date (optional)
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink focus:border-brick"
            />
            {(state?.fieldErrors?.endDate || isInvalidDateRange) && (
              <p className="mt-1 text-xs text-brick">
                {state?.fieldErrors?.endDate || 'End date cannot be earlier than start date.'}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="budgetRupees" className="block text-xs font-medium text-ink-2 mb-1">
            Total budget in rupees (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2 text-sm">
              ₹
            </span>
            <input
              id="budgetRupees"
              name="budgetRupees"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="50,000"
              className="w-full border border-rule bg-paper-2 pl-7 pr-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick font-mono tabular-numbers"
            />
          </div>
          {state?.fieldErrors?.budgetRupees && (
            <p className="mt-1 text-xs text-brick">{state.fieldErrors.budgetRupees}</p>
          )}
        </div>

        <div>
          <label htmlFor="displayName" className="block text-xs font-medium text-ink mb-1">
            Your name on this trip <span className="text-brick">*</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Rohan"
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
          />
          <p className="mt-1 text-xs text-ink-2">
            You will be added as the trip admin.
          </p>
          {state?.fieldErrors?.displayName && (
            <p className="mt-1 text-xs text-brick">{state.fieldErrors.displayName}</p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending || isInvalidDateRange}
            className="w-full sm:w-auto bg-brick hover:bg-brick-dark text-paper px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Creating trip...' : 'Create trip'}
          </button>
        </div>
      </form>
    </div>
  );
}
