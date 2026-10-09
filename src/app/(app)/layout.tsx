import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/actions/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Load user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-dvh flex flex-col justify-between">
      <header className="border-b border-rule px-4 py-3 sm:px-8 bg-paper">
        <div className="max-w-ledger mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/trips" className="font-serif text-xl font-normal text-ink">
              TripTabTally
            </Link>
            <nav className="hidden sm:flex items-center space-x-4 text-sm">
              <Link href="/trips" className="text-ink hover:underline">
                Trips
              </Link>
              <Link href="/trips/new" className="text-ink-2 hover:text-ink">
                New trip
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4 text-xs sm:text-sm">
            <Link href="/profile" className="text-ink-2 hover:text-ink">
              {displayName}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-brick hover:underline text-xs"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
