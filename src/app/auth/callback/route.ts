import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return '/trips';
  // Prevent open redirect attacks
  if (rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\')) {
    return rawNext;
  }
  return '/trips';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return user to login with error message if exchange fails
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
