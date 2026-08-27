import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SetPasswordForm from '@/components/SetPasswordForm'

export const dynamic = 'force-dynamic'

// Reached right after verifying identity by code/link. The member chooses a
// password here, then logs in with email + password from then on.
export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <SetPasswordForm email={user.email ?? ''} />
}
