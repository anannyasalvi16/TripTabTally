'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { joinTripAction, type MemberActionResult } from '@/actions/members';

interface MemberSummary {
  id: string;
  display_name: string;
  isPlaceholder: boolean;
}

interface JoinClientViewProps {
  token: string;
  tripName: string;
  destination: string | null;
  members: MemberSummary[];
  placeholders: MemberSummary[];
  isSignedIn: boolean;
  isAlreadyMember: boolean;
  tripId: string;
  defaultDisplayName: string;
}

export function JoinClientView({
  token,
  tripName,
  destination,
  members,
  placeholders,
  isSignedIn,
  isAlreadyMember,
  tripId,
  defaultDisplayName,
}: JoinClientViewProps) {
  const [state, formAction, isPending] = useActionState<MemberActionResult | null, FormData>(
    joinTripAction,
    null
  );

  return (
    <div className="min-h-dvh flex flex-col justify-between">
      <header className="border-b border-rule px-4 py-4 sm:px-8">
        <div className="max-w-ledger mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-normal text-ink">
            TripTabTally
          </Link>
          <span className="text-xs text-ink-2">Trip invite</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-form w-full border border-rule p-8 bg-paper">
          <span className="font-mono text-xs text-ink-2 block mb-2">Invitation</span>
          <h1 className="font-serif text-3xl font-normal text-ink">
            Join {tripName}
          </h1>
          {destination && (
            <p className="mt-1 text-xs text-ink-2">Destination: {destination}</p>
          )}

          {state && !state.ok && state.message && (
            <div className="mt-4 p-3 border border-brick text-brick text-xs bg-paper-2">
              {state.message}
            </div>
          )}

          {isAlreadyMember ? (
            <div className="mt-6 border-t border-rule pt-4">
              <p className="text-sm text-ink mb-4">
                You are already a member of this trip.
              </p>
              <Link
                href={`/trips/${tripId}`}
                className="inline-block bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
              >
                Go to trip
              </Link>
            </div>
          ) : !isSignedIn ? (
            <div className="mt-6 border-t border-rule pt-4">
              <p className="text-sm text-ink mb-2">
                Sign in to join this trip and view group expenses.
              </p>
              <p className="text-xs text-ink-2 mb-6">
                Current members on trip: {members.map((m) => m.display_name).join(', ') || 'None yet'}
              </p>
              <Link
                href={`/login?next=/join/${token}`}
                className="inline-block bg-brick hover:bg-brick-dark text-paper px-5 py-2.5 text-sm font-medium transition-colors"
              >
                Sign in to join
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-8">
              {/* Claim Placeholder Section */}
              {placeholders.length > 0 && (
                <div className="border border-rule p-4 bg-paper-2">
                  <h2 className="font-serif text-base font-normal text-ink mb-1">
                    Did someone already add you?
                  </h2>
                  <p className="text-xs text-ink-2 mb-3">
                    Select your name below to claim past expenses recorded for you.
                  </p>
                  <div className="space-y-2">
                    {placeholders.map((p) => (
                      <form key={p.id} action={formAction} className="flex items-center justify-between">
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="claimMemberId" value={p.id} />
                        <span className="text-sm text-ink font-medium">{p.display_name}</span>
                        <button
                          type="submit"
                          disabled={isPending}
                          className="border border-brick text-brick hover:bg-brick hover:text-paper px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {isPending ? 'Claiming...' : "That's me"}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              )}

              {/* Join as New Member Form */}
              <div className="border-t border-rule pt-4">
                <h2 className="font-serif text-base font-normal text-ink mb-1">
                  {placeholders.length > 0 ? 'Or join as a new member' : 'Join as a member'}
                </h2>
                <form action={formAction} className="mt-3 space-y-3">
                  <input type="hidden" name="token" value={token} />
                  <div>
                    <label htmlFor="displayName" className="block text-xs font-medium text-ink mb-1">
                      Your display name
                    </label>
                    <input
                      id="displayName"
                      name="displayName"
                      type="text"
                      required
                      maxLength={60}
                      defaultValue={defaultDisplayName}
                      placeholder="e.g. Anannya"
                      className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isPending ? 'Joining trip...' : 'Join trip'}
                  </button>
                </form>
              </div>

              {members.length > 0 && (
                <div className="text-xs text-ink-2 border-t border-rule pt-3">
                  <span>Other members: </span>
                  <span>{members.map((m) => m.display_name).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-rule px-4 py-4 text-center text-xs text-ink-2">
        <span>TripTabTally • Shared group ledger</span>
      </footer>
    </div>
  );
}
