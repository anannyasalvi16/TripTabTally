import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './ProfileForm';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, upi_id')
    .eq('id', user?.id)
    .single();

  return (
    <div className="max-w-form mx-auto py-8 px-4 sm:px-0">
      <div className="border-b border-rule pb-4 mb-6">
        <h1 className="font-serif text-3xl font-normal text-ink">
          Profile settings
        </h1>
        <p className="text-xs text-ink-2 mt-1">
          Manage your personal details and UPI payment address.
        </p>
      </div>

      <ProfileForm
        initialDisplayName={profile?.display_name || ''}
        initialUpiId={profile?.upi_id || ''}
        email={user?.email || ''}
      />
    </div>
  );
}
