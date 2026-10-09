import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col justify-between">
      <header className="border-b border-rule px-4 py-4 sm:px-8">
        <div className="max-w-ledger mx-auto flex items-center justify-between">
          <div>
            <span className="font-serif text-2xl font-normal tracking-tight text-ink">
              TripTabTally
            </span>
          </div>
          <nav className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm text-ink-2 hover:text-ink transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/trips/new"
              className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
            >
              New trip
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-12 sm:px-8">
        <div className="max-w-form mx-auto">
          <div className="border-b border-rule pb-8">
            <h1 className="font-serif text-4xl sm:text-5xl font-normal text-ink leading-tight">
              A ledger for group trips.
            </h1>
            <p className="mt-4 text-base text-ink-2 leading-relaxed">
              Set a shared budget, record who paid for what, and settle up with the fewest possible payments.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/trips/new"
                className="bg-brick hover:bg-brick-dark text-paper px-5 py-2.5 text-sm font-medium transition-colors"
              >
                Start a trip
              </Link>
              <Link
                href="/login"
                className="border border-ink text-ink hover:bg-paper-2 px-5 py-2.5 text-sm font-medium transition-colors"
              >
                Sign in with link
              </Link>
            </div>
          </div>

          <div className="py-8 border-b border-rule">
            <h2 className="font-serif text-xl font-normal text-ink">
              How it works
            </h2>
            <div className="mt-4 space-y-4 text-sm text-ink-2">
              <div className="border-t border-rule pt-3">
                <span className="font-mono text-xs text-ink block mb-1">01</span>
                <p className="text-ink font-medium">Create and invite</p>
                <p className="mt-1">Add trip dates and an optional budget. Send an invite link to your group.</p>
              </div>
              <div className="border-t border-rule pt-3">
                <span className="font-mono text-xs text-ink block mb-1">02</span>
                <p className="text-ink font-medium">Record expenses</p>
                <p className="mt-1">Log costs in rupees with exact, equal, percentage, or share splits.</p>
              </div>
              <div className="border-t border-rule pt-3">
                <span className="font-mono text-xs text-ink block mb-1">03</span>
                <p className="text-ink font-medium">Settle up via UPI</p>
                <p className="mt-1">Clear all debts with the minimal number of direct UPI payment links.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-rule px-4 py-6 sm:px-8 text-xs text-ink-2">
        <div className="max-w-ledger mx-auto flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <span>Settlement calculated using greedy debt simplification. All money stored in integer paise.</span>
          </div>
          <div className="flex space-x-4">
            <span>Version 0.1.0</span>
            <Link href="/login" className="hover:underline text-ink">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
