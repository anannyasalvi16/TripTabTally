'use client';

import Link from 'next/link';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12">
      <div className="max-w-form w-full border border-rule p-8 bg-paper">
        <span className="font-mono text-xs text-brick block mb-2">Error</span>
        <h1 className="font-serif text-2xl font-normal text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          An error occurred while loading this page.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/trips"
            className="border border-ink text-ink hover:bg-paper-2 px-4 py-2 text-sm font-medium transition-colors"
          >
            Go to your trips
          </Link>
        </div>
      </div>
    </div>
  );
}
