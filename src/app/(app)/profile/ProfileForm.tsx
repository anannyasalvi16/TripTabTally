'use client';

import { useActionState } from 'react';
import { updateProfileAction, type ProfileActionResult } from '@/actions/profile';
import { signOut } from '@/actions/auth';

interface ProfileFormProps {
  initialDisplayName: string;
  initialUpiId: string;
  email: string;
}

export function ProfileForm({
  initialDisplayName,
  initialUpiId,
  email,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<ProfileActionResult | null, FormData>(
    updateProfileAction,
    null
  );

  return (
    <div className="space-y-8">
      {state && !state.ok && state.message && (
        <div className="p-3 border border-brick text-brick text-xs bg-paper-2">
          {state.message}
        </div>
      )}

      {state && state.ok && state.message && (
        <div className="p-3 border border-moss text-moss text-xs bg-paper-2">
          {state.message}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Email address
          </label>
          <input
            type="email"
            disabled
            value={email}
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink-2 cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-xs font-medium text-ink mb-1">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            maxLength={60}
            defaultValue={initialDisplayName}
            placeholder="Your name"
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
          />
          {state?.fieldErrors?.displayName && (
            <p className="mt-1 text-xs text-brick">{state.fieldErrors.displayName}</p>
          )}
        </div>

        <div>
          <label htmlFor="upiId" className="block text-xs font-medium text-ink-2 mb-1">
            UPI ID (optional)
          </label>
          <input
            id="upiId"
            name="upiId"
            type="text"
            maxLength={64}
            defaultValue={initialUpiId}
            placeholder="e.g. name@okhdfcbank"
            className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick font-mono"
          />
          <p className="mt-1 text-xs text-ink-2">
            Used to generate UPI payment links when other trip members settle up with you.
          </p>
          {state?.fieldErrors?.upiId && (
            <p className="mt-1 text-xs text-brick">{state.fieldErrors.upiId}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="bg-brick hover:bg-brick-dark text-paper px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      <div className="border-t border-rule pt-6">
        <h3 className="font-serif text-base font-normal text-ink mb-2">
          Account session
        </h3>
        <form action={signOut}>
          <button
            type="submit"
            className="border border-ink text-ink hover:bg-paper-2 px-4 py-2 text-xs font-medium transition-colors"
          >
            Sign out of account
          </button>
        </form>
      </div>
    </div>
  );
}
