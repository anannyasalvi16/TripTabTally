'use client';

import { useState, useActionState } from 'react';
import {
  updateProfileAction,
  deleteAccountAction,
  type ProfileActionResult,
} from '@/actions/profile';
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
  const [updateState, updateFormAction, isPendingUpdate] = useActionState<
    ProfileActionResult | null,
    FormData
  >(updateProfileAction, null);

  const [deleteState, deleteFormAction, isPendingDelete] = useActionState<
    ProfileActionResult | null,
    FormData
  >(deleteAccountAction, null);

  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-8">
      {/* Update notices */}
      {updateState && !updateState.ok && updateState.message && (
        <div className="p-3 border border-brick text-brick text-xs bg-paper-2">
          {updateState.message}
        </div>
      )}

      {updateState && updateState.ok && updateState.message && (
        <div className="p-3 border border-moss text-moss text-xs bg-paper-2">
          {updateState.message}
        </div>
      )}

      {deleteState && !deleteState.ok && deleteState.message && (
        <div className="p-3 border border-brick text-brick text-xs bg-paper-2">
          {deleteState.message}
        </div>
      )}

      {/* Profile details form */}
      <form action={updateFormAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-ink-2 mb-1">
            Email address
          </label>
          <input
            id="email"
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
          {updateState?.fieldErrors?.displayName && (
            <p className="mt-1 text-xs text-brick">{updateState.fieldErrors.displayName}</p>
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
          {updateState?.fieldErrors?.upiId && (
            <p className="mt-1 text-xs text-brick">{updateState.fieldErrors.upiId}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPendingUpdate}
          className="bg-brick hover:bg-brick-dark text-paper px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPendingUpdate ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {/* Sign out section */}
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

      {/* Data and Account deletion section (TRD Section 12) */}
      <div className="border-t border-rule pt-6 space-y-3">
        <h3 className="font-serif text-base font-normal text-brick mb-1">
          Delete account
        </h3>
        <p className="text-xs text-ink-2 leading-relaxed">
          Permanently removes your account and profile data. On any trips where you participated, your name will be anonymised to &quot;Former member&quot; so past balances and arithmetic history remain intact.
        </p>

        <form action={deleteFormAction} className="space-y-3 pt-2">
          <label className="flex items-start gap-2 cursor-pointer text-xs text-ink">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand that deleting my account is permanent and my name will be anonymised on all trips.
            </span>
          </label>

          <button
            type="submit"
            disabled={!confirmDelete || isPendingDelete}
            className="border border-brick text-brick hover:bg-brick hover:text-paper px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brick"
          >
            {isPendingDelete ? 'Deleting account...' : 'Permanently delete account'}
          </button>
        </form>
      </div>
    </div>
  );
}
