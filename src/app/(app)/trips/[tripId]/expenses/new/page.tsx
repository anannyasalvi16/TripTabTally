import Link from 'next/link';

interface NewExpensePageProps {
  params: Promise<{ tripId: string }>;
}

export default async function NewExpensePage({ params }: NewExpensePageProps) {
  const { tripId } = await params;

  return (
    <div className="max-w-form mx-auto py-6">
      <div className="border-b border-rule pb-3 mb-6">
        <Link
          href={`/trips/${tripId}`}
          className="text-xs text-ink-2 hover:text-ink transition-colors block mb-2"
        >
          ← Back to trip
        </Link>
        <h1 className="font-serif text-3xl font-normal text-ink">
          Add expense
        </h1>
        <p className="text-xs text-ink-2 mt-1">
          Record a shared cost for this trip.
        </p>
      </div>

      <div className="border border-rule p-6 bg-paper">
        <p className="text-sm text-ink-2">
          The full live split engine and expense form will be active in Phase 4.
        </p>
        <div className="mt-4">
          <Link
            href={`/trips/${tripId}`}
            className="inline-block bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-sm font-medium transition-colors"
          >
            Return to expenses
          </Link>
        </div>
      </div>
    </div>
  );
}
