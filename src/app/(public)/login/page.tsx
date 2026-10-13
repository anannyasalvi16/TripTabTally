'use client';

import { Suspense, useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signInWithOtp, signInWithGoogle, type AuthActionResult } from '@/actions/auth';
import { sanitizeNextUrl } from '@/lib/security';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = sanitizeNextUrl(searchParams.get('next'));
  const errorParam = searchParams.get('error');

  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    signInWithOtp,
    null
  );

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (state?.ok) {
      setCooldown(60);
    }
  }, [state]);

  const isRateLimited = Boolean(
    state && !state.ok && state.message && state.message.toLowerCase().includes('rate limit')
  );

  async function handleGoogleClick() {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const res = await signInWithGoogle(next);
      if (res.ok && res.url) {
        window.location.href = res.url;
      } else {
        setGoogleError(res.message || 'Could not connect to Google sign in.');
      }
    } catch {
      setGoogleError('Connection failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="max-w-form w-full py-8">
      <div className="border-b border-rule pb-4 mb-6">
        <span className="font-mono text-xs text-ink-2 block mb-2">Sign in</span>
        <h1 className="font-serif text-3xl font-normal text-ink">
          Access your trip ledgers
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Enter your email to receive a sign-in link, or continue with Google.
        </p>
      </div>

      {errorParam && (
        <div className="mt-4 p-3 border border-brick text-brick text-sm bg-paper-2">
          Authentication link is invalid or expired. Please request a new link.
        </div>
      )}

      {state && !state.ok && state.message && (
        <div className="mt-4 p-3 border border-brick text-brick text-sm bg-paper-2 space-y-1">
          <p className="font-medium">{state.message}</p>
          {isRateLimited && (
            <p className="text-xs text-ink-2 pt-1 border-t border-rule">
              Tip: Google authentication below is unaffected by email limits and works immediately.
            </p>
          )}
        </div>
      )}

      {googleError && (
        <div className="mt-4 p-3 border border-brick text-brick text-sm bg-paper-2">
          {googleError}
        </div>
      )}

      {state && state.ok && state.message ? (
        <div className="mt-6 p-4 border border-moss text-moss text-sm bg-paper-2 space-y-2">
          <p className="font-medium">Link sent</p>
          <p className="text-ink">{state.message}</p>
          {cooldown > 0 && (
            <p className="text-xs text-ink-2">
              Resend available in {cooldown}s.
            </p>
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-ink-2 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || cooldown > 0}
            className="w-full bg-brick hover:bg-brick-dark text-paper px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending
              ? 'Sending magic link...'
              : cooldown > 0
              ? `Wait ${cooldown}s to resend`
              : 'Send magic link'}
          </button>
        </form>
      )}

      <div className="my-6 border-t border-rule relative">
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper px-2 text-xs text-ink-2">
          or
        </span>
      </div>

      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={googleLoading}
        className={`w-full border text-ink hover:bg-paper-2 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          isRateLimited ? 'border-brick bg-paper-2 font-semibold' : 'border-ink'
        }`}
      >
        {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col justify-between">
      <header className="border-b border-rule px-4 py-4 sm:px-8">
        <div className="max-w-ledger mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-normal text-ink">
            TripTabTally
          </Link>
          <Link href="/" className="text-sm text-ink-2 hover:text-ink transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <div className="max-w-form w-full border border-rule p-8 bg-paper text-sm text-ink-2">
              Loading sign in...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <footer className="border-t border-rule px-4 py-4 text-center text-xs text-ink-2 space-y-1">
        <div>No passwords stored. Sessions expire automatically.</div>
        <div>Made by Anannya Salvi, 2026</div>
      </footer>
    </div>
  );
}
