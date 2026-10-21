'use client';

import { Suspense, useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithPassword,
  signUpWithPassword,
  type AuthActionResult,
} from '@/actions/auth';
import { sanitizeNextUrl } from '@/lib/security';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = sanitizeNextUrl(searchParams.get('next'));
  const errorParam = searchParams.get('error');

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  const [signInState, signInAction, isSignInPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(signInWithPassword, null);

  const [signUpState, signUpAction, isSignUpPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(signUpWithPassword, null);

  return (
    <div className="max-w-form w-full py-8">
      <div className="border-b border-rule pb-4 mb-6">
        <span className="font-mono text-xs text-ink-2 block mb-2">Authentication</span>
        <h1 className="font-serif text-3xl font-normal text-ink">
          {activeTab === 'signin' ? 'Sign in to your account' : 'Create a new account'}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {activeTab === 'signin'
            ? 'Enter your email and password to access your trip ledgers.'
            : 'Register with your email and password to start managing trip budgets.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-rule mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('signin')}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === 'signin'
              ? 'border-brick text-ink font-semibold'
              : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('signup')}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === 'signup'
              ? 'border-brick text-ink font-semibold'
              : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          Create account
        </button>
      </div>

      {errorParam && (
        <div className="mb-4 p-3 border border-brick text-brick text-sm bg-paper-2">
          Authentication session was interrupted or invalid. Please sign in again.
        </div>
      )}

      {/* Sign in tab form */}
      {activeTab === 'signin' && (
        <div>
          {signInState && !signInState.ok && signInState.message && (
            <div className="mb-4 p-3 border border-brick text-brick text-sm bg-paper-2">
              {signInState.message}
            </div>
          )}

          <form action={signInAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <div>
              <label
                htmlFor="signin-email"
                className="block text-xs font-medium text-ink-2 mb-1"
              >
                Email address
              </label>
              <input
                id="signin-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="name@example.com"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
              />
            </div>

            <div>
              <label
                htmlFor="signin-password"
                className="block text-xs font-medium text-ink-2 mb-1"
              >
                Password
              </label>
              <input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Your password"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
              />
            </div>

            <button
              type="submit"
              disabled={isSignInPending}
              className="w-full bg-brick hover:bg-brick-dark text-paper px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSignInPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className="text-xs text-ink-2 hover:text-ink underline transition-colors"
            >
              Do not have an account? Create one here
            </button>
          </div>
        </div>
      )}

      {/* Create account tab form */}
      {activeTab === 'signup' && (
        <div>
          {signUpState && !signUpState.ok && signUpState.message && (
            <div className="mb-4 p-3 border border-brick text-brick text-sm bg-paper-2">
              {signUpState.message}
            </div>
          )}

          {signUpState && signUpState.ok && signUpState.message && (
            <div className="mb-4 p-4 border border-moss text-moss text-sm bg-paper-2 space-y-1">
              <p className="font-medium text-moss">Account created</p>
              <p className="text-ink">{signUpState.message}</p>
            </div>
          )}

          <form action={signUpAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-medium text-ink-2 mb-1"
              >
                Your name (optional)
              </label>
              <input
                id="signup-name"
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={60}
                placeholder="e.g. Rohan Mehta"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-medium text-ink-2 mb-1"
              >
                Email address
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="name@example.com"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-medium text-ink-2 mb-1"
              >
                Password
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick"
              />
              <span className="text-xs text-ink-2 mt-1 block">
                Must be at least 6 characters.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSignUpPending}
              className="w-full bg-brick hover:bg-brick-dark text-paper px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSignUpPending ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className="text-xs text-ink-2 hover:text-ink underline transition-colors"
            >
              Already have an account? Sign in here
            </button>
          </div>
        </div>
      )}
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
              Loading authentication...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <footer className="border-t border-rule px-4 py-4 text-center text-xs text-ink-2 space-y-1">
        <div>Secure authentication powered by Supabase.</div>
        <div>Made by Anannya Salvi, 2026</div>
      </footer>
    </div>
  );
}
