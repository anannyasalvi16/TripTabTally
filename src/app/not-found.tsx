import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12">
      <div className="max-w-form w-full border border-rule p-8 bg-paper">
        <span className="font-mono text-xs text-ink-2 block mb-2">404</span>
        <h1 className="font-serif text-2xl font-normal text-ink">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          There is no page at this address.
        </p>
        <div className="mt-6">
          <Link
            href="/trips"
            className="inline-block bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
          >
            Go to your trips
          </Link>
        </div>
      </div>
    </div>
  );
}
